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

async function createCheckout({
  productName,
  metadataKey,
  id,
  amountPence,
  successUrl,
  cancelUrl,
}: {
  productName: string;
  metadataKey: "repeat_request_id" | "lab_order_id";
  id: string;
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
    "line_items[0][price_data][product_data][name]": productName,
    client_reference_id: id,
    [`metadata[${metadataKey}]`]: id,
    [`payment_intent_data[metadata][${metadataKey}]`]: id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Stripe's shortest life for a payment page, so an old tab cannot be paid hours later.
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
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

/** A hosted payment page for one repeat prescription request. */
export function createRepeatCheckout({
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
  return createCheckout({ productName: "Repeat prescription request", metadataKey: "repeat_request_id", id: requestId, amountPence, successUrl, cancelUrl });
}

/** A hosted payment page for one blood test order. Stripe is told "Blood test", never the panel. */
export function createOrderCheckout({
  orderId,
  amountPence,
  successUrl,
  cancelUrl,
}: {
  orderId: string;
  amountPence: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  return createCheckout({ productName: "Blood test", metadataKey: "lab_order_id", id: orderId, amountPence, successUrl, cancelUrl });
}

export type Refund = { id: string; status: string; amountPence: number };

type RawRefund = { id?: unknown; status?: unknown; amount?: unknown };

function toRefund(data: RawRefund): Refund {
  if (typeof data.id !== "string" || !data.id.startsWith("re_") || typeof data.status !== "string" || typeof data.amount !== "number" || !Number.isInteger(data.amount)) {
    throw new Error("Stripe sent back an unexpected refund.");
  }
  return { id: data.id, status: data.status, amountPence: data.amount };
}

/** The refunds Stripe holds for one payment that have not failed or been cancelled, newest first. */
export async function listPaymentRefunds(paymentIntent: string): Promise<Refund[]> {
  const { STRIPE_SECRET_KEY } = getStripeEnv();
  const response = await fetch(`${API}/refunds?${new URLSearchParams({ payment_intent: paymentIntent, limit: "20" })}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Stripe-Version": "2024-06-20" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stripe refused to list the refunds (${response.status}).`);
  const data = (await response.json()) as { data?: unknown };
  if (!Array.isArray(data.data)) throw new Error("Stripe sent back an unexpected list of refunds.");
  return (data.data as RawRefund[]).map(toRefund).filter((r) => r.status === "succeeded" || r.status === "pending");
}

/**
 * Refunds the whole of one payment. No amount is sent, so Stripe returns everything that was paid. The
 * idempotency key is fixed for the thing being refunded, so pressing the button twice, or retrying after a
 * dropped connection, can never refund twice. Stripe keeps a key for about a day: after that, a retry
 * is answered "already refunded", and then the refunds Stripe already holds are read instead and their
 * total is returned, so the caller can record them. Stripe is told our id only.
 */
async function refundPayment({
  key,
  paymentIntent,
  metadataKey,
  id,
}: {
  key: string;
  paymentIntent: string;
  metadataKey: "lab_order_id" | "repeat_request_id";
  id: string;
}): Promise<Refund> {
  const { STRIPE_SECRET_KEY } = getStripeEnv();
  const response = await fetch(`${API}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      "Idempotency-Key": key,
    },
    body: new URLSearchParams({ payment_intent: paymentIntent, [`metadata[${metadataKey}]`]: id }),
    cache: "no-store",
  });
  if (response.ok) return toRefund((await response.json()) as RawRefund);
  const failure = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
  if (response.status === 400 && failure?.error?.code === "charge_already_refunded") {
    const held = await listPaymentRefunds(paymentIntent);
    const first = held[0];
    if (first) return { id: first.id, status: first.status, amountPence: held.reduce((sum, r) => sum + r.amountPence, 0) };
  }
  throw new Error(`Stripe refused the refund (${response.status}).`);
}

/** Refunds the whole payment of one blood test order. */
export function refundOrderPayment({ orderId, paymentIntent }: { orderId: string; paymentIntent: string }): Promise<Refund> {
  return refundPayment({ key: `lab-order-refund-${orderId}`, paymentIntent, metadataKey: "lab_order_id", id: orderId });
}

/** Refunds the whole fee of one repeat prescription request. */
export function refundRepeatPayment({ requestId, paymentIntent }: { requestId: string; paymentIntent: string }): Promise<Refund> {
  return refundPayment({ key: `repeat-request-refund-${requestId}`, paymentIntent, metadataKey: "repeat_request_id", id: requestId });
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
