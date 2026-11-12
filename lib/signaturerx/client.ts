import "server-only";

import { z } from "zod";

import { getSignatureRxEnv } from "@/lib/env";

/**
 * The few SignatureRx calls Clinic Hub makes, over its REST API (OpenAPI 1.0.3), so no SDK is needed.
 * The clinic's OAuth client (client credentials) gets a token; each prescriber's own integration
 * code says whose prescription it is. A prescriber's signing PIN passes through here once, in the
 * request body, and is never stored, logged or put in an error message.
 */

/** A SignatureRx call that failed. The message is safe to show to staff: no secret is ever in it. */
export class SignatureRxError extends Error {
  constructor(
    public readonly kind: "auth" | "refused" | "invalid" | "unavailable",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SignatureRxError";
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const prescriptionSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.string().max(60).optional(),
  detailed_status: z.string().max(60).optional(),
});

const errorSchema = z.object({
  message: z.string().optional(),
  errors: z.union([z.string(), z.record(z.string(), z.array(z.string()))]).optional(),
});

/** One token is kept for as long as it lasts (SignatureRx issues them for 15 days), less a margin. */
let cached: { token: string; expiresAt: number } | null = null;
const MARGIN_MS = 5 * 60 * 1000;

function origin(): string {
  return getSignatureRxEnv().SIGNATURERX_BASE_URL;
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt - MARGIN_MS > Date.now()) return cached.token;
  const { SIGNATURERX_CLIENT_ID, SIGNATURERX_CLIENT_SECRET } = getSignatureRxEnv();
  let response: Response;
  try {
    response = await fetch(`${origin()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: SIGNATURERX_CLIENT_ID, client_secret: SIGNATURERX_CLIENT_SECRET, grant_type: "client_credentials" }),
      cache: "no-store",
      // A redirect would resend the body (a PIN, a code, patient details) to another address, so none is followed.
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new SignatureRxError("unavailable", "SignatureRx could not be reached. Try again in a moment.");
  }
  if (!response.ok) {
    cached = null;
    throw new SignatureRxError("auth", "SignatureRx did not accept the clinic's credentials. Ask the technical team to check them.", response.status);
  }
  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new SignatureRxError("auth", "SignatureRx sent back an unexpected answer to the sign-in.", response.status);
  cached = { token: parsed.data.access_token, expiresAt: Date.now() + parsed.data.expires_in * 1000 };
  return cached.token;
}

/** A short, readable reason from SignatureRx's own validation answer, with no values from our side. */
async function reasonFrom(response: Response): Promise<string> {
  const body = errorSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) return "";
  const { message, errors } = body.data;
  const detail = typeof errors === "string" ? errors : errors ? Object.values(errors).flat().slice(0, 3).join(" ") : "";
  return `${message ?? ""} ${detail}`.trim().slice(0, 240);
}

async function call(path: string, init: { method: "GET" | "POST"; body?: unknown; integrationCode?: string }): Promise<Response> {
  const token = await accessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.integrationCode) headers["integration-code"] = init.integrationCode;
  let response: Response;
  try {
    response = await fetch(`${origin()}/api/v1${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      // A redirect would resend the body (a PIN, a code, patient details) to another address, so none is followed.
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SignatureRxError("unavailable", "SignatureRx could not be reached. Nothing was sent. Try again in a moment.");
  }
  if (response.status === 401) {
    // The token may have been revoked: forget it so the next call asks again.
    cached = null;
    throw new SignatureRxError("auth", "SignatureRx did not accept the request. Try again; if it repeats, ask the technical team.", 401);
  }
  if (response.status === 403 || response.status === 422 || response.status === 400) {
    const reason = await reasonFrom(response);
    throw new SignatureRxError("invalid", reason ? `SignatureRx refused it: ${reason}` : "SignatureRx refused it. Check the details and the signing PIN.", response.status);
  }
  if (!response.ok) throw new SignatureRxError("unavailable", "SignatureRx had a problem. Nothing was confirmed. Try again later.", response.status);
  return response;
}

/** True when SignatureRx accepts the clinic's credentials. Used by the check script and the status line. */
export async function checkConnection(): Promise<void> {
  await accessToken();
}

export type SignatureRxPatient = {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  email: string;
  /** Digits only, with the country code, for example 447700900123. */
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country: string;
  /** Our own patient reference. */
  clientRefId: string;
};

export type SignatureRxMedicine = { description: string; qty: string; directions: string };

export type SignatureRxPrescription = {
  id: string;
  status: string | null;
  detailedStatus: string | null;
};

function toPrescription(value: unknown): SignatureRxPrescription {
  const parsed = prescriptionSchema.safeParse(value);
  if (!parsed.success) throw new SignatureRxError("invalid", "SignatureRx sent back an unexpected answer. Check SignatureRx before trying again.");
  return { id: parsed.data.id, status: parsed.data.status ?? null, detailedStatus: parsed.data.detailed_status ?? null };
}

/**
 * Creates a prescription for one patient. `draft` saves it for the prescriber to sign inside
 * SignatureRx; `issueOnly` signs and issues it with the PIN. SignatureRx requires the PIN either way.
 */
export async function createPrescription(input: {
  action: "draft" | "issueOnly";
  integrationCode: string;
  securePin: string;
  prescriberIp: string;
  /** Our own reference for the prescription: the repeat request id. */
  clientRefId: string;
  notes?: string;
  patient: SignatureRxPatient;
  medicines: SignatureRxMedicine[];
}): Promise<SignatureRxPrescription> {
  const p = input.patient;
  const response = await call("/ehr-prescription-patient", {
    method: "POST",
    body: {
      action: input.action,
      integration_code: input.integrationCode,
      secure_pin: input.securePin,
      prescriber_ip: input.prescriberIp,
      client_ref_id: input.clientRefId,
      notes: input.notes,
      notify: false,
      medicines: input.medicines.map((m) => ({ description: m.description, qty: m.qty, directions: m.directions })),
      patient: {
        first_name: p.firstName,
        last_name: p.lastName,
        gender: p.gender,
        email: p.email,
        phone: p.phone,
        birth_day: p.birthDay,
        birth_month: p.birthMonth,
        birth_year: p.birthYear,
        address_ln1: p.addressLine1,
        address_ln2: p.addressLine2,
        city: p.city,
        post_code: p.postcode,
        country: p.country,
        client_ref_id: p.clientRefId,
      },
    },
  });
  return toPrescription(await response.json().catch(() => null));
}

/** The current state of one prescription, asked with its prescriber's integration code. */
export async function getPrescription(prescriptionId: string, integrationCode: string): Promise<SignatureRxPrescription> {
  const response = await call(`/prescriptions/${encodeURIComponent(prescriptionId)}`, { method: "GET", integrationCode });
  return toPrescription(await response.json().catch(() => null));
}
