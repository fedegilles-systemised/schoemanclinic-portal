import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isStripeConfigured } from "@/lib/env";
import { announceRequest } from "@/lib/prescriptions/notify";
import { verifyStripeSignature } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

const sessionSchema = z.object({
  id: z.string().max(255),
  payment_status: z.string(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  payment_intent: z.string().max(255).nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
});

const eventSchema = z.object({
  id: z.string().max(255),
  type: z.string().max(100),
  data: z.object({ object: z.unknown() }),
});

async function markFailed(admin: ReturnType<typeof createAdminClient>, id: string, error: string): Promise<void> {
  await admin.from("webhook_events").update({ status: "failed", error, processed_at: new Date().toISOString() }).eq("id", id);
}

/**
 * Stripe tells us a repeat prescription fee was paid. The signature proves the call is from Stripe;
 * each event is stored once by its id, so a retried event is not handled twice; only the amount and
 * our request id are kept, never the customer's details.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) return new NextResponse(null, { status: 404 });
  const raw = await request.text();
  if (raw.length > 256_000 || !verifyStripeSignature(raw, request.headers.get("stripe-signature"))) {
    return new NextResponse(null, { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const event = eventSchema.safeParse(parsedJson);
  if (!event.success) return new NextResponse(null, { status: 400 });
  // Other events are acknowledged and left alone.
  if (!PAID_EVENTS.has(event.data.type)) return new NextResponse(null, { status: 200 });

  // Only our own repeat request payments are handled. Anything else on the clinic's Stripe account
  // (GoHighLevel invoices, for example) is acknowledged and left alone, so Stripe never retries it.
  const session = sessionSchema.safeParse(event.data.data.object);
  if (!session.success) return new NextResponse(null, { status: 200 });
  const s = session.data;
  const parsedId = z.uuid().safeParse(s.metadata?.repeat_request_id);
  if (!parsedId.success) return new NextResponse(null, { status: 200 });
  const requestId = parsedId.data;
  // Paid by bank transfer or similar: Stripe sends async_payment_succeeded later.
  if (s.payment_status !== "paid" || s.currency !== "gbp" || s.amount_total === null) {
    return new NextResponse(null, { status: 200 });
  }

  const admin = createAdminClient();
  const stored = await admin
    .from("webhook_events")
    .insert({
      source: "stripe",
      external_event_id: event.data.id,
      event_type: event.data.type,
      payload: { session: s.id, repeat_request_id: requestId, amount_total: s.amount_total },
    })
    .select("id")
    .single();
  let eventRowId: string;
  if (stored.error) {
    if (stored.error.code !== "23505") return new NextResponse(null, { status: 500 });
    // Already stored: Stripe is retrying. Done before means nothing to do; otherwise the first
    // attempt stopped part-way, so finish it (recording the payment is safe to repeat).
    const existing = await admin
      .from("webhook_events")
      .select("id, status")
      .eq("source", "stripe")
      .eq("external_event_id", event.data.id)
      .maybeSingle();
    if (existing.error || !existing.data) return new NextResponse(null, { status: 500 });
    if (existing.data.status !== "received") return new NextResponse(null, { status: 200 });
    eventRowId = existing.data.id;
  } else {
    eventRowId = stored.data.id;
  }

  const paid = await admin.rpc("mark_repeat_request_paid", {
    _request: requestId,
    _session: s.id,
    _payment_intent: s.payment_intent ?? "",
    _amount: s.amount_total,
  });
  if (paid.error) {
    // A wrong amount, or a request declined before payment, cannot be fixed by retrying: store it
    // for the team and stop Stripe retrying.
    // Anything else (a dropped connection) answers 500, so Stripe tries again and nothing is lost.
    if (paid.error.code !== "22023") return new NextResponse(null, { status: 500 });
    await markFailed(admin, eventRowId, "The payment could not be applied: a wrong amount, or a request already declined. Check and refund it in Stripe.");
    console.error("Stripe payment not recorded: wrong amount or a declined request.");
    return new NextResponse(null, { status: 200 });
  }
  if (!paid.data) {
    // Not newly paid: Stripe repeating this very payment is fine; anything else is a second payment
    // (two payment pages) or a request that is gone, which the team must refund by hand.
    const existing = await admin.from("repeat_requests").select("stripe_checkout_session_id").eq("id", requestId).maybeSingle();
    if (existing.error) return new NextResponse(null, { status: 500 });
    if (existing.data?.stripe_checkout_session_id !== s.id) {
      await markFailed(admin, eventRowId, "A second payment, or a payment for a request that was not found. Refund it in Stripe.");
      console.error("Stripe payment not recorded: the request was already paid or not found.");
      return new NextResponse(null, { status: 200 });
    }
  }
  await admin.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", eventRowId);
  if (paid.data) await announceRequest(requestId, { paid: true });
  return new NextResponse(null, { status: 200 });
}
