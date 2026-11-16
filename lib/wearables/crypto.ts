import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getWearableTokenKey } from "@/lib/env";

const VERSION = "v1";

/**
 * Encrypts a wearable token before it reaches the database: AES-256-GCM with a fresh 12-byte IV, stored
 * as `v1.<iv>.<tag>.<ciphertext>` in base64url. The patient and provider are bound in as additional
 * data, so a token copied onto another row does not decrypt.
 */
export function encryptWearableToken(token: string, binding: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(getWearableTokenKey(), "base64"), iv);
  cipher.setAAD(Buffer.from(binding));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws if the value was changed, belongs to another row or was made with another key. */
export function decryptWearableToken(value: string, binding: string): string {
  const [version, iv, tag, body] = value.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unreadable token.");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(getWearableTokenKey(), "base64"), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

/** What a token is bound to: the patient and the provider. */
export function tokenBinding(patientId: string, provider: string): string {
  return `${patientId}:${provider}`;
}
