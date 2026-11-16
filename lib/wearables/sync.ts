import "server-only";

import type { WearableProviderId } from "@/lib/env";
import { decryptWearableToken, encryptWearableToken, tokenBinding } from "@/lib/wearables/crypto";
import { getWearableProvider } from "@/lib/wearables/providers";
import { londonDay, ProviderAuthError } from "@/lib/wearables/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** A linked account as the database lists it, with its tokens still encrypted. */
export type DueConnection = {
  id: string;
  patient_id: string;
  provider: WearableProviderId;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  synced_through: string | null;
};

const FIRST_DAYS = 30;
const OVERLAP_DAYS = 2;
const MAX_DAYS = 60;
const REFRESH_BEFORE_MS = 10 * 60 * 1000;
const PER_RUN = 40;
const TIME_BUDGET_MS = 45_000;

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reads one linked account: refreshes its token if it is about to end (and stores the new pair at
 * once, since a refresh token is used only once), reads the days since the last sync and stores them.
 * Never throws: a failure is recorded on the link in a fixed sentence, and tried again tomorrow.
 */
export async function syncConnection(row: DueConnection): Promise<"synced" | "reconnect" | "failed"> {
  const admin = createAdminClient();
  const provider = getWearableProvider(row.provider);
  const record = async (through: string | null, error: string | null, reconnect: boolean) => {
    const done = await admin.rpc("record_wearable_sync", { _connection: row.id, _through: through as string, _error: error as string, _needs_reconnect: reconnect });
    if (done.error) console.error("A wearable sync result was not recorded.");
  };
  if (!provider) {
    await record(null, "This wearable is no longer supported.", false);
    return "failed";
  }
  try {
    const binding = tokenBinding(row.patient_id, row.provider);
    let accessToken = decryptWearableToken(row.access_token_encrypted, binding);
    if (new Date(row.expires_at).getTime() - Date.now() < REFRESH_BEFORE_MS) {
      const next = await provider.refresh(decryptWearableToken(row.refresh_token_encrypted, binding));
      const saved = await admin.rpc("update_wearable_tokens", {
        _connection: row.id,
        _access_encrypted: encryptWearableToken(next.accessToken, binding),
        _refresh_encrypted: encryptWearableToken(next.refreshToken, binding),
        _expires_at: next.expiresAt.toISOString(),
      });
      // If the new pair is lost the old refresh token is spent, so the patient has to connect again.
      if (saved.error) throw new ProviderAuthError("The new token was not stored.");
      accessToken = next.accessToken;
    }

    const today = londonDay(new Date());
    let from = row.synced_through ? shiftDay(row.synced_through, -OVERLAP_DAYS) : shiftDay(today, -FIRST_DAYS);
    if (from < shiftDay(today, -MAX_DAYS)) from = shiftDay(today, -MAX_DAYS);
    const readings = await provider.fetchReadings(accessToken, from, today);

    for (let i = 0; i < readings.length; i += 500) {
      const chunk = readings.slice(i, i + 500).map((r) => ({ metric: r.metric, value: r.value, measured_on: r.measuredOn }));
      const stored = await admin.rpc("upsert_wearable_readings", { _patient: row.patient_id, _provider: row.provider, _rows: chunk });
      if (stored.error) throw new Error("Readings were not stored.");
    }
    await record(today, null, false);
    return "synced";
  } catch (error) {
    if (error instanceof ProviderAuthError) {
      await record(null, "The provider no longer accepts the link. Connect again.", true);
      return "reconnect";
    }
    // Nothing from the provider or the readings is written to the log.
    console.error(`A wearable sync failed: ${error instanceof Error ? error.constructor.name : "unknown"}.`);
    await record(null, "The last read did not finish. It is tried again tomorrow.", false);
    return "failed";
  }
}

export type WearableSyncResult = { dropped: number; synced: number; reconnect: number; failed: number };

/**
 * The daily run: removes the links of patients who withdrew consent, then reads each due account, oldest
 * sync first, up to a limit and a time budget. What is left over is picked up the next day.
 */
export async function syncWearables(): Promise<WearableSyncResult> {
  const admin = createAdminClient();
  const result: WearableSyncResult = { dropped: 0, synced: 0, reconnect: 0, failed: 0 };

  const dropped = await admin.rpc("drop_unconsented_wearable_connections");
  if (dropped.error) throw new Error("Could not remove links without consent.");
  result.dropped = dropped.data?.length ?? 0;
  for (const link of dropped.data ?? []) {
    const provider = getWearableProvider(link.provider);
    if (!provider?.revoke) continue;
    try {
      await provider.revoke(decryptWearableToken(link.access_token_encrypted, tokenBinding(link.patient_id, link.provider)));
    } catch {
      // Best effort: the link is already gone on our side.
    }
  }

  const due = await admin.rpc("wearable_connections_due", { _limit: PER_RUN });
  if (due.error) throw new Error("Could not list the wearables that are due.");
  const started = Date.now();
  for (const row of due.data ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const outcome = await syncConnection(row);
    if (outcome === "synced") result.synced += 1;
    else if (outcome === "reconnect") result.reconnect += 1;
    else result.failed += 1;
  }
  return result;
}
