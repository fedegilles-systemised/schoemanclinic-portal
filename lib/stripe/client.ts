import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getStripeEnv } from "@/lib/env";

/**
 * The few Stripe calls Clinic Hub makes, over Stripe's REST API, so no SDK is needed. Stripe is
 * told an amount and our request id, never a name, email or medicine: its hosted page collects the
 * card, and the clinic never sees card details.
 */

const API = "https://api.stripe.com/v1";
/** Stripe's own default. A signed event older than this is refused, so a captured one cannot be replayed later. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export type CheckoutSession = { id: string; url: string };

/** A hosted payment page for one repeat prescription request. */
export async function createRepeatCheckout({
  requestId,
  amountPence,
  successUrl,
  cancelUrl,
}: {
  requestId: string;
  amountPence: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const { STRIPE_SECRET_KEY } = getStripeEnv();
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": "Repeat prescription request",
    client_reference_id: requestId,
    "metadata[repeat_request_id]": requestId,
    "payment_intent_data[metadata][repeat_request_id]": requestId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  const response = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stripe refused the payment page (${response.status}).`);
  const data = (await response.json()) as { id?: unknown; url?: unknown };
  if (typeof data.id !== "string" || typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Stripe sent back an unexpected payment page.");
  }
  return { id: data.id, url: data.url };
}

/**
 * Checks a webhook's Stripe-Signature header against the raw body, as Stripe documents: an HMAC
 * SHA-256 of "<timestamp>.<body>" with the endpoint's signing secret, within five minutes.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, now = Date.now()): boolean {
  if (!header) return false;
  const { STRIPE_WEBHOOK_SECRET } = getStripeEnv();
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex"));
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
