import "server-only";

import { getWearableProviderEnv } from "@/lib/env";
import type { DailyReading, TokenSet, WearableProvider } from "@/lib/wearables/providers/types";
import { asRecord, isNumber, londonDay, ProviderAuthError, providerFetch } from "@/lib/wearables/providers/types";

const AUTHORISE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer/v2";
// offline gives a refresh token; the others are the recovery and sleep figures.
const SCOPE = "offline read:recovery read:sleep";

function credentials() {
  const env = getWearableProviderEnv("whoop");
  if (!env) throw new Error("WHOOP is not set up.");
  return env;
}

async function tokens(body: Record<string, string>): Promise<TokenSet> {
  const response = await providerFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (response.status === 400 || response.status === 401) throw new ProviderAuthError("WHOOP refused the link.");
  if (!response.ok) throw new Error("WHOOP did not answer.");
  const json = asRecord(await response.json());
  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  const expiresIn = json.expires_in;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !isNumber(expiresIn)) throw new Error("WHOOP sent an unexpected answer.");
  return { accessToken, refreshToken, expiresAt: new Date(Date.now() + expiresIn * 1000), scope: typeof json.scope === "string" ? json.scope : SCOPE };
}

async function records(accessToken: string, path: string, start: string, end: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let next: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const params = new URLSearchParams({ limit: "25", start, end });
    if (next) params.set("nextToken", next);
    const response = await providerFetch(`${API}${path}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 401) throw new ProviderAuthError("WHOOP refused the link.");
    if (!response.ok) throw new Error("WHOOP did not answer.");
    const json = asRecord(await response.json());
    if (Array.isArray(json.records)) for (const row of json.records) rows.push(asRecord(row));
    next = typeof json.next_token === "string" && json.next_token ? json.next_token : null;
    if (!next) break;
  }
  return rows;
}

/** Turns what WHOOP sent into Clinic Hub's daily figures. Only scored records; a nap is not last night. */
export function mapWhoop(data: { sleeps: Record<string, unknown>[]; recoveries: Record<string, unknown>[] }): DailyReading[] {
  const out: DailyReading[] = [];
  const add = (metric: DailyReading["metric"], value: unknown, day: string) => {
    if (isNumber(value)) out.push({ metric, value, measuredOn: day });
  };

  // The day of a sleep is the day it ended, in London. If two, the longer one.
  const dayOfSleep = new Map<string, string>();
  const longest = new Map<string, { minutes: number; performance: unknown }>();
  for (const s of data.sleeps) {
    if (s.nap === true || s.score_state !== "SCORED" || typeof s.end !== "string") continue;
    const end = new Date(s.end);
    if (Number.isNaN(end.getTime())) continue;
    const day = londonDay(end);
    if (typeof s.id === "string") dayOfSleep.set(s.id, day);
    const score = asRecord(s.score);
    const stages = asRecord(score.stage_summary);
    if (!isNumber(stages.total_in_bed_time_milli) || !isNumber(stages.total_awake_time_milli)) continue;
    const minutes = Math.round((stages.total_in_bed_time_milli - stages.total_awake_time_milli) / 60000);
    const held = longest.get(day);
    if (!held || held.minutes < minutes) longest.set(day, { minutes, performance: score.sleep_performance_percentage });
  }
  for (const [day, sleep] of longest) {
    add("sleep_minutes", sleep.minutes, day);
    add("sleep_score", sleep.performance, day);
  }

  for (const r of data.recoveries) {
    if (r.score_state !== "SCORED") continue;
    const day = (typeof r.sleep_id === "string" && dayOfSleep.get(r.sleep_id)) || (typeof r.created_at === "string" && !Number.isNaN(new Date(r.created_at).getTime()) ? londonDay(new Date(r.created_at)) : null);
    if (!day) continue;
    const score = asRecord(r.score);
    add("readiness_score", score.recovery_score, day);
    add("resting_heart_rate", score.resting_heart_rate, day);
    add("hrv_ms", isNumber(score.hrv_rmssd_milli) ? Math.round(score.hrv_rmssd_milli * 10) / 10 : null, day);
    add("spo2_percent", score.spo2_percentage, day);
  }
  return out;
}

export const whoop: WearableProvider = {
  id: "whoop",
  label: "WHOOP",
  authorisationUrl(state) {
    const { clientId, redirectUri } = credentials();
    return `${AUTHORISE_URL}?${new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: SCOPE, state })}`;
  },
  exchangeCode(code) {
    const { clientId, clientSecret, redirectUri } = credentials();
    return tokens({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret });
  },
  refresh(refreshToken) {
    const { clientId, clientSecret } = credentials();
    return tokens({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, scope: "offline" });
  },
  async fetchReadings(accessToken, from, to) {
    // A day earlier and later, so a sleep that crosses midnight is whole; the days asked for are kept below.
    const start = new Date(`${from}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 2);
    const [sleeps, recoveries] = await Promise.all([
      records(accessToken, "/activity/sleep", start.toISOString(), end.toISOString()),
      records(accessToken, "/recovery", start.toISOString(), end.toISOString()),
    ]);
    return mapWhoop({ sleeps, recoveries }).filter((r) => r.measuredOn >= from && r.measuredOn <= to);
  },
  async revoke(accessToken) {
    await providerFetch(`${API}/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  },
};
