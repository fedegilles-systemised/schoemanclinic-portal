import "server-only";

import { z } from "zod";

import { announceOrderRefunded } from "@/lib/orders/notify";
import { announceRepeatRefunded } from "@/lib/prescriptions/notify";
import { listPaymentRefunds } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Refunds that happen in Stripe itself, not from Clinic Hub: someone presses Refund in Stripe's dashboard.
 * Stripe tells the webhook; a refund of the whole payment is recorded against the order or the repeat
 * request, the patient is told, and nothing else changes. A part refund is not recorded, and a refund that
 * Stripe later marks as failed is not undone: in both cases the admins are told, with a link, so a person
 * decides. Each event is stored once by its id, so a retried event is not handled twice.
 */

export const REFUND_EVENTS = new Set(["charge.refunded", "refund.failed", "charge.refund.updated"]);

const chargeSchema = z.object({
  payment_intent: z.string().max(255).nullable(),
  amount: z.number().int(),
  amount_refunded: z.number().int(),
  currency: z.string(),
  latest_refund: z.string().max(255).nullable().optional(),
});

const refundSchema = z.object({
  id: z.string().max(255),
  status: z.string(),
  payment_intent: z.string().max(255).nullable(),
});

type Admin = ReturnType<typeof createAdminClient>;
type Target = { kind: "order"; id: string; pricePence: number; refundedAt: string | null } | { kind: "request"; id: string; pricePence: number; refundedAt: string | null };

async function findTarget(admin: Admin, paymentIntent: string): Promise<Target | null | "error"> {
  const [order, request] = await Promise.all([
    admin.from("lab_orders").select("id, price_pence, refunded_at").eq("stripe_payment_intent_id", paymentIntent).maybeSingle(),
    admin.from("repeat_requests").select("id, fee_pence, refunded_at").eq("stripe_payment_intent_id", paymentIntent).maybeSingle(),
  ]);
  if (order.error || request.error) return "error";
  if (order.data) return { kind: "order", id: order.data.id, pricePence: order.data.price_pence, refundedAt: order.data.refunded_at };
  if (request.data) return { kind: "request", id: request.data.id, pricePence: request.data.fee_pence, refundedAt: request.data.refunded_at };
  return null;
}

async function tellAdmins(admin: Admin, title: string, body: string, link: string): Promise<void> {
  const { data: roles, error } = await admin.from("user_roles").select("user_id, profile:profiles!user_roles_user_id_fkey(status)").eq("role", "admin");
  const recipients = (roles ?? []).filter((r) => r.profile?.status === "active").map((r) => r.user_id);
  if (error || recipients.length === 0) {
    console.error("Admins not told about a Stripe refund: no one to tell.");
    return;
  }
  const { error: insertError } = await admin.from("notifications").insert(recipients.map((userId) => ({ user_id: userId, topic: "payments" as const, title, body, link })));
  if (insertError) console.error("Admins not told about a Stripe refund.");
}

async function finish(admin: Admin, rowId: string, status: "processed" | "failed", error?: string): Promise<void> {
  await admin.from("webhook_events").update({ status, error: error ?? null, processed_at: new Date().toISOString() }).eq("id", rowId);
}

/** Returns "done" when Stripe can stop sending the event, or "retry" when a failure may pass. */
export async function handleRefundEvent(event: { id: string; type: string; object: unknown }): Promise<"done" | "retry"> {
  const isCharge = event.type === "charge.refunded";
  const charge = isCharge ? chargeSchema.safeParse(event.object) : null;
  const refund = isCharge ? null : refundSchema.safeParse(event.object);
  if ((charge && !charge.success) || (refund && !refund.success)) return "done";
  // charge.refund.updated is only of interest when the refund has failed.
  if (refund?.success && refund.data.status !== "failed") return "done";
  const paymentIntent = charge?.success ? charge.data.payment_intent : refund?.success ? refund.data.payment_intent : null;
  if (!paymentIntent) return "done";
  if (charge?.success && charge.data.currency !== "gbp") return "done";

  const admin = createAdminClient();
  const target = await findTarget(admin, paymentIntent);
  if (target === "error") return "retry";
  // Not ours: GoHighLevel invoices and other payments on the clinic's Stripe account are left alone.
  if (target === null) return "done";

  const stored = await admin
    .from("webhook_events")
    .insert({ source: "stripe", external_event_id: event.id, event_type: event.type, payload: { kind: target.kind, id: target.id } })
    .select("id")
    .single();
  let rowId: string;
  if (stored.error) {
    if (stored.error.code !== "23505") return "retry";
    const existing = await admin.from("webhook_events").select("id, status").eq("source", "stripe").eq("external_event_id", event.id).maybeSingle();
    if (existing.error || !existing.data) return "retry";
    if (existing.data.status !== "received") return "done";
    rowId = existing.data.id;
  } else {
    rowId = stored.data.id;
  }

  const link = target.kind === "order" ? "/clinic/orders" : `/clinic/prescriptions/${target.id}`;
  const what = target.kind === "order" ? "a blood test order" : "a repeat prescription fee";

  if (refund?.success) {
    await tellAdmins(admin, "A refund failed in Stripe", `A refund of ${what} failed in Stripe. Clinic Hub shows it as refunded: check it in Stripe and put it right.`, link);
    await finish(admin, rowId, "processed");
    return "done";
  }

  if (!charge?.success) return "done";
  const c = charge.data;
  if (target.refundedAt) {
    await finish(admin, rowId, "processed");
    return "done";
  }
  // The event is only a nudge: what Stripe holds for this payment decides. The refunds that have not failed must
  // add up to exactly the price paid, so a made-up event cannot record a refund that did not happen.
  let held;
  try {
    held = await listPaymentRefunds(paymentIntent);
  } catch {
    return "retry";
  }
  const total = held.reduce((sum, refund) => sum + refund.amountPence, 0);
  const refundId = held[0]?.id ?? null;
  if (!refundId || c.amount !== target.pricePence || total !== target.pricePence) {
    if (!refundId && c.amount_refunded === 0) {
      await finish(admin, rowId, "processed");
      return "done";
    }
    await tellAdmins(admin, "A part refund was made in Stripe", `A part refund of ${what} was made in Stripe, or its refunds do not add up to the whole payment. Clinic Hub records whole refunds only, so it shows no refund: check it in Stripe.`, link);
    await finish(admin, rowId, "failed", "A part refund made in Stripe is not recorded in Clinic Hub.");
    return "done";
  }

  // The person is empty: Stripe made the refund, so no one in Clinic Hub asked for it.
  const recorded =
    target.kind === "order"
      ? await admin.rpc("record_lab_order_refund", { _order: target.id, _refund: refundId, _amount: total, _by: null as unknown as string })
      : await admin.rpc("record_repeat_request_refund", { _request: target.id, _refund: refundId, _amount: total, _by: null as unknown as string });
  if (recorded.error) {
    // A wrong amount or a state that cannot take a refund will not mend by retrying.
    if (recorded.error.code !== "22023") return "retry";
    await finish(admin, rowId, "failed", "The refund could not be applied. Check it in Stripe.");
    await tellAdmins(admin, "A refund made in Stripe could not be recorded", `A refund of ${what} was made in Stripe but Clinic Hub could not record it. Check it in Stripe.`, link);
    return "done";
  }
  await finish(admin, rowId, "processed");
  if (recorded.data) {
    if (target.kind === "order") await announceOrderRefunded(target.id);
    else await announceRepeatRefunded(target.id);
  }
  return "done";
}
