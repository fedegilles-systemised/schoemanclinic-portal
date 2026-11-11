import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

type ThrottledAction =
  | "sign-in"
  | "password-reset"
  | "password-change"
  | "email-change"
  | "invitation-send"
  | "invitation-accept"
  | "results-entry"
  | "booking"
  | "question"
  | "document-upload";

// A clinic shares one address, so the address limit is well above the account limits.
const LIMITS: Record<ThrottledAction, { windowSeconds: number; address: number; addressAndAccount: number; account: number }> = {
  "sign-in": { windowSeconds: 15 * 60, address: 60, addressAndAccount: 10, account: 30 },
  "password-reset": { windowSeconds: 60 * 60, address: 20, addressAndAccount: 3, account: 3 },
  // Both check the current password, so they are limited like sign-in.
  "password-change": { windowSeconds: 15 * 60, address: 60, addressAndAccount: 8, account: 20 },
  "email-change": { windowSeconds: 60 * 60, address: 20, addressAndAccount: 5, account: 5 },
  // Sending is per inviter. Accepting is per link, so one stolen link cannot be guessed at or hammered.
  "invitation-send": { windowSeconds: 60 * 60, address: 80, addressAndAccount: 40, account: 40 },
  "invitation-accept": { windowSeconds: 15 * 60, address: 60, addressAndAccount: 10, account: 15 },
  // Each entry can carry a file, so this keeps a stuck script from filling storage.
  "results-entry": { windowSeconds: 60 * 60, address: 300, addressAndAccount: 120, account: 120 },
  // Each booking sends a calendar event and messages, so a script must not be able to fill a diary.
  booking: { windowSeconds: 60 * 60, address: 60, addressAndAccount: 20, account: 20 },
  // Each new question and reply sends a message, so a script must not be able to flood the clinic or a patient.
  question: { windowSeconds: 60 * 60, address: 120, addressAndAccount: 30, account: 30 },
  // Each upload carries a file, so this keeps a stuck script from filling storage.
  "document-upload": { windowSeconds: 60 * 60, address: 300, addressAndAccount: 120, account: 120 },
};

/** Stored as a hash, so the table holds no plain email or IP address. */
function bucketKey(action: ThrottledAction, ...parts: string[]): string {
  return createHash("sha256").update([action, ...parts].join("|")).digest("hex");
}

/** The host sets these headers. Confirm that after each change of host: see docs/SECURITY.md, S-32. */
async function clientAddress(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return requestHeaders.get("x-real-ip")?.trim() || forwarded || null;
}

/**
 * Counts an attempt and says whether it may go ahead. Sign-in and reset reach Supabase
 * from this server, so its own limits cannot tell one visitor from another. If the check
 * itself fails the attempt goes ahead: an outage here must not stop people signing in.
 */
export async function allowAuthAttempt(action: ThrottledAction, email: string): Promise<boolean> {
  const limits = LIMITS[action];
  const account = email.trim().toLowerCase();
  const address = await clientAddress();

  const buckets = [
    { key: bucketKey(action, "account", account), limit: limits.account },
    ...(address
      ? [
          { key: bucketKey(action, "address", address), limit: limits.address },
          { key: bucketKey(action, "both", address, account), limit: limits.addressAndAccount },
        ]
      : []),
  ];

  try {
    const { data, error } = await createAdminClient().rpc("auth_throttle_hit", {
      _keys: buckets.map((bucket) => bucket.key),
      _limits: buckets.map((bucket) => bucket.limit),
      _window_seconds: limits.windowSeconds,
    });
    if (error) throw new Error(error.code ?? "rpc error");
    return data !== false;
  } catch (cause) {
    // No email or address in the log.
    console.error("Auth throttle unavailable:", cause instanceof Error ? cause.message : "unknown error");
    return true;
  }
}
