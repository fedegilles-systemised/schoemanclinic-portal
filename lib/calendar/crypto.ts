import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getGoogleEnv } from "@/lib/env";

const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(getGoogleEnv().GOOGLE_TOKEN_ENCRYPTION_KEY, "base64");
}

/**
 * Encrypts a Google refresh token before it reaches the database: AES-256-GCM with a fresh
 * 12-byte IV, stored as `v1.<iv>.<tag>.<ciphertext>` in base64url. The user id is bound in as
 * additional data, so a token copied onto another person's row does not decrypt.
 */
export function encryptToken(token: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws if the value was changed, belongs to someone else or was made with another key. */
export function decryptToken(value: string, userId: string): string {
  const [version, iv, tag, body] = value.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unreadable token.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
