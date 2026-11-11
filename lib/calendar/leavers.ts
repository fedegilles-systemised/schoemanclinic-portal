import "server-only";

import { decryptToken } from "@/lib/calendar/crypto";
import { tryRevokeToken } from "@/lib/calendar/google";
import { createAdminClient } from "@/lib/supabase/admin";

/** After this many failed tries a token is left for a person to look at; it stays encrypted. */
const MAX_ATTEMPTS = 10;

/**
 * Revokes at Google the tokens of team members who were switched off (queued by the database), then
 * clears each stored token. Returns how many were revoked and how many are still waiting.
 */
export async function revokeLeaverTokens(): Promise<{ revoked: number; waiting: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_revocations")
    .select("id, user_id, refresh_token_encrypted")
    .is("revoked_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("queued_at")
    .limit(50);
  if (error) throw new Error("Could not read the Google revocation queue.");

  let revoked = 0;
  for (const row of data) {
    let done = false;
    if (!row.refresh_token_encrypted) {
      done = true;
    } else {
      try {
        done = await tryRevokeToken(decryptToken(row.refresh_token_encrypted, row.user_id));
      } catch {
        // Unreadable with the current key: nothing this server can revoke. Counted as a failed try.
        done = false;
      }
    }
    const saved = await admin.rpc("mark_google_revocation", { _id: row.id, _revoked: done });
    if (!saved.error && done) revoked += 1;
  }
  if (data.length > revoked) console.error(`Google revocation: ${data.length - revoked} token(s) not revoked this run.`);
  return { revoked, waiting: data.length - revoked };
}
