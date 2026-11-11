import "server-only";

import { getGhlEnv } from "@/lib/env";

/**
 * GoHighLevel API v2, for the few calls Clinic Hub makes: find or create a contact, and send them a
 * message. Every call is server-side, with the clinic's Private Integration token.
 */

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const TIMEOUT_MS = 10_000;

export class GhlError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const env = getGhlEnv();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GHL_PRIVATE_TOKEN}`,
      Version: API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string };
  // The message names the call only: GoHighLevel's replies can echo contact details.
  if (!response.ok) throw new GhlError(`GoHighLevel ${path} failed`, response.status);
  return json;
}

export type ContactDetails = { firstName: string; lastName: string; email?: string | null; phone?: string | null };

/** Finds the contact by email or phone, or creates it. Returns the GoHighLevel contact id. */
export async function upsertContact(details: ContactDetails): Promise<string> {
  const env = getGhlEnv();
  const result = await call<{ contact?: { id?: string } }>("/contacts/upsert", {
    locationId: env.GHL_LOCATION_ID,
    firstName: details.firstName,
    lastName: details.lastName,
    ...(details.email ? { email: details.email } : {}),
    ...(details.phone ? { phone: details.phone } : {}),
  });
  if (!result.contact?.id) throw new GhlError("GoHighLevel returned no contact id", 502);
  return result.contact.id;
}

/** An email from the clinic's GoHighLevel, so it sits in the contact's conversation history. */
export async function sendEmail(contactId: string, subject: string, html: string): Promise<void> {
  await call("/conversations/messages", { type: "Email", contactId, subject, html });
}

/**
 * A WhatsApp message. GoHighLevel sends it as a text, and the clinic's plug-in diverts the clinic's
 * texts to WhatsApp, so the patient receives it on WhatsApp.
 */
export async function sendWhatsApp(contactId: string, message: string): Promise<void> {
  await call("/conversations/messages", { type: "SMS", contactId, message });
}
