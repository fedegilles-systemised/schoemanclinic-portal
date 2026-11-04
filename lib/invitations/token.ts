import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** A new link token: 32 random bytes. It goes into the email once and is never stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database keeps: a hash, so a stolen copy of the table cannot be used as a link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A token as it arrives from a link: the right shape, or null. */
export function cleanToken(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
