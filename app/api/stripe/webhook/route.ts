import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isStripeConfigured } from "@/lib/env";
import { announcePaidRequest } from "@/lib/prescriptions/notify";
import { verifyStripeSignature } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

const sessionSchema = z.object({
  id: z.string().max(255),
  payment_status: z.string(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  client_reference_id: z.uuid().nullable(),
  payment_intent: z.string().max(255).nullable(),
  metadata: z.object({ repeat_request_id: z.uuid().optional() }).nullable(),
});

const eventSchema = z.object({
  id: z.string().max(255),
  type: z.string().max(100),
  data: z.object({ object: z.unknown() }),
});

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

  const session = sessionSchema.safeParse(event.data.data.object);
  if (!session.success) return new NextResponse(null, { status: 400 });
  const s = session.data;
  const requestId = s.metadata?.repeat_request_id ?? s.client_reference_id;
  // Paid by bank transfer or similar: Stripe sends async_payment_succeeded later.
  if (s.payment_status !== "paid" || !requestId || s.currency !== "gbp" || s.amount_total === null) {
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
    await admin
      .from("webhook_events")
      .update({ status: "failed", error: "The payment could not be matched to a request.", processed_at: new Date().toISOString() })
      .eq("id", eventRowId);
    console.error("Stripe payment not recorded: it did not match a repeat request.");
    // Answer 200: retrying cannot fix a mismatch, and the failure is stored for the team.
    return new NextResponse(null, { status: 200 });
  }
  await admin.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", eventRowId);
  if (paid.data) await announcePaidRequest(requestId);
  return new NextResponse(null, { status: 200 });
}
