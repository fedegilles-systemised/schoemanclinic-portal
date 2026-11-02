/**
 * Session cookies and their signing, shared by the server client and the proxy. Server
 * code only: it reads the secret. The limits themselves are in session-limits.ts, which
 * the browser also uses.
 */

import { getSessionEnv } from "@/lib/env";
import { SESSION_LIMITS } from "@/lib/supabase/session-limits";

/** Long enough for the longest session. The limits above end a session sooner. */
const COOKIE_MAX_AGE_SECONDS = SESSION_LIMITS.patient.totalSeconds;

export const LAST_SEEN_COOKIE = "ch_last_seen";
export const SESSION_KIND_COOKIE = "ch_session_kind";

/** No browser code reads the session: every Supabase call runs on the server. */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** The options for our own session cookies. */
export const SESSION_COOKIE_OPTIONS = { ...AUTH_COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE_SECONDS };

/**
 * @supabase/ssr overwrites `maxAge` with its 400-day default whatever `cookieOptions`
 * says, so it is set again on each write. A `maxAge` of 0 is a removal: keep it.
 */
export function withSessionMaxAge<T extends { maxAge?: number }>(options: T): T {
  return options.maxAge === 0 ? options : { ...options, maxAge: COOKIE_MAX_AGE_SECONDS };
}

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function macKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionEnv().SESSION_COOKIE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** The signature covers the cookie's name and the person, so it cannot move to another cookie or account. */
function signedMessage(name: string, value: string, userId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${name}|${userId}|${value}`);
}

/** `value.signature`: cookies that only the server can make. */
export async function signSessionValue(name: string, value: string, userId: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await macKey("sign"), signedMessage(name, value, userId));
  return `${value}.${toHex(signature)}`;
}

/** The value if the signature holds for this cookie and person, otherwise null. */
export async function readSessionValue(
  name: string,
  raw: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!raw) return null;
  const split = raw.lastIndexOf(".");
  if (split < 1) return null;
  const value = raw.slice(0, split);
  const signature = fromHex(raw.slice(split + 1));
  if (!signature) return null;
  const valid = await crypto.subtle.verify("HMAC", await macKey("verify"), signature, signedMessage(name, value, userId));
  return valid ? value : null;
}
