import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getLabWebhookSecrets } from "@/lib/env";
import { MAX_LAB_FILE_BYTES } from "@/lib/labs/constants";
import { announceLabFile } from "@/lib/labs/notify";
import { FILE_FIELD_NAMES, looksLikePdf, normaliseKey, readBase64Pdf, readReport } from "@/lib/labs/parse";
import { receiveLabFile } from "@/lib/labs/receive";

/** Compared as digests, so the length of a secret is not given away and the comparison takes the same time. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function reply(status: number, body: Record<string, string>): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** One level of nesting is read as if it were flat: { patient: { email } } counts as email. A top-level field always wins over a nested one. */
function flatten(source: Record<string, unknown>, into: Map<string, string>): void {
  const nested: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" || typeof value === "number") into.set(normaliseKey(key), String(value));
    else if (value && typeof value === "object" && !Array.isArray(value)) nested.push(value as Record<string, unknown>);
  }
  for (const group of nested) {
    for (const [key, value] of Object.entries(group)) {
      const name = normaliseKey(key);
      if ((typeof value === "string" || typeof value === "number") && !into.has(name)) into.set(name, String(value));
    }
  }
}

/**
 * A lab provider posts one report: the PDF, and the patient's name, email and date of birth. Each
 * provider has its own address and its own secret, sent as "Authorization: Bearer <secret>". The PDF
 * goes to the import queue: filed under the patient when exactly one patient matches by email and date
 * of birth, otherwise waiting for a PA to match it. Nothing is released and no value is read from it.
 * The answer never says whether a patient was found. A report sent twice is recorded once.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await params;
  const provider = raw.toLowerCase();
  const secrets = getLabWebhookSecrets();
  const expected = secrets.get(provider);
  // An unknown provider and a switched-off webhook look the same.
  if (!expected) return new NextResponse(null, { status: 404 });

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!sameSecret(bearer, expected)) return reply(401, { error: "The secret was not accepted." });
  if (!(await allowAuthAttempt("lab-webhook", provider))) return reply(429, { error: "Too many requests. Try again later." });

  const type = request.headers.get("content-type") ?? "";
  const fields = new Map<string, string>();
  let bytes: Uint8Array | null = null;

  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      let file: File | null = null;
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") fields.set(normaliseKey(key), value);
        else if (!file || FILE_FIELD_NAMES.includes(normaliseKey(key))) file = value;
      }
      if (file) bytes = new Uint8Array(await file.arrayBuffer());
    } else if (type.includes("application/json")) {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "Send a JSON object." });
      flatten(body as Record<string, unknown>, fields);
      const encoded = readBase64Pdf(fields);
      if (encoded) bytes = new Uint8Array(Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
    } else {
      return reply(415, { error: "Send multipart/form-data or JSON with the PDF in base64." });
    }
  } catch {
    return reply(400, { error: "The request could not be read." });
  }

  if (!bytes || bytes.length === 0) return reply(400, { error: "No PDF was found in the request." });
  if (bytes.length > MAX_LAB_FILE_BYTES) return reply(413, { error: "The PDF is too large. Send a link to it instead." });
  if (!looksLikePdf(bytes)) return reply(422, { error: "The file is not a PDF." });

  const report = readReport(fields);
  if (!report.email && !report.name) return reply(422, { error: "The report needs a patient email or name." });

  try {
    const result = await receiveLabFile(provider, bytes, report);
    if (result.status === "accepted") await announceLabFile({ matched: result.matched });
    return reply(200, { status: result.status });
  } catch {
    // Nothing from the request is logged: it holds a patient's details. The lab is asked to try again.
    console.error("Lab file was not stored.");
    return reply(500, { error: "The report could not be stored. Try again." });
  }
}
