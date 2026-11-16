import "server-only";

import { getWearableProviderEnv } from "@/lib/env";
import type { DailyReading, TokenSet, WearableProvider } from "@/lib/wearables/providers/types";
import { asRecord, isNumber, ProviderAuthError, providerFetch } from "@/lib/wearables/providers/types";

const AUTHORISE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API = "https://api.ouraring.com";
// The least that gives daily figures: daily summaries (with sleep periods) and daily blood oxygen.
const SCOPE = "daily spo2Daily";

function credentials() {
  const env = getWearableProviderEnv("oura");
  if (!env) throw new Error("Oura is not set up.");
  return env;
}

async function tokens(body: Record<string, string>): Promise<TokenSet> {
  const response = await providerFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (response.status === 400 || response.status === 401) throw new ProviderAuthError("Oura refused the link.");
  if (!response.ok) throw new Error("Oura did not answer.");
  const json = asRecord(await response.json());
  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  const expiresIn = json.expires_in;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !isNumber(expiresIn)) throw new Error("Oura sent an unexpected answer.");
  return { accessToken, refreshToken, expiresAt: new Date(Date.now() + expiresIn * 1000), scope: typeof json.scope === "string" ? json.scope : SCOPE };
}

/** The rows of one Oura collection between two days, following its pages. A 403 means that part was not allowed. */
async function collection(accessToken: string, name: string, from: string, to: string, sandbox: boolean): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = [];
  let next: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ start_date: from, end_date: to });
    if (next) params.set("next_token", next);
    const path = sandbox ? `/v2/sandbox/usercollection/${name}` : `/v2/usercollection/${name}`;
    const response = await providerFetch(`${API}${path}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 401) throw new ProviderAuthError("Oura refused the link.");
    if (response.status === 403) return null;
    if (!response.ok) throw new Error("Oura did not answer.");
    const json = asRecord(await response.json());
    if (Array.isArray(json.data)) for (const row of json.data) rows.push(asRecord(row));
    next = typeof json.next_token === "string" && json.next_token ? json.next_token : null;
    if (!next) break;
  }
  return rows;
}

/** Turns what Oura sent into Clinic Hub's daily figures. Anything missing or odd is left out. */
export function mapOura(data: {
  sleepScores: Record<string, unknown>[];
  readiness: Record<string, unknown>[];
  sleepPeriods: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  spo2: Record<string, unknown>[];
  vo2: Record<string, unknown>[];
}): DailyReading[] {
  const out: DailyReading[] = [];
  const add = (metric: DailyReading["metric"], value: unknown, day: unknown) => {
    if (isNumber(value) && typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) out.push({ metric, value, measuredOn: day });
  };
  for (const r of data.sleepScores) add("sleep_score", r.score, r.day);
  for (const r of data.readiness) {
    add("readiness_score", r.score, r.day);
    add("temperature_deviation_c", r.temperature_deviation, r.day);
  }
  // Only the main sleep of each day, and if there are two the longer: a nap is not last night.
  const longest = new Map<string, Record<string, unknown>>();
  for (const r of data.sleepPeriods) {
    if (r.type !== "long_sleep" || typeof r.day !== "string" || !isNumber(r.total_sleep_duration)) continue;
    const held = longest.get(r.day);
    if (!held || (held.total_sleep_duration as number) < r.total_sleep_duration) longest.set(r.day, r);
  }
  for (const [day, r] of longest) {
    add("sleep_minutes", isNumber(r.total_sleep_duration) ? Math.round(r.total_sleep_duration / 60) : null, day);
    add("hrv_ms", r.average_hrv, day);
    add("resting_heart_rate", r.lowest_heart_rate, day);
  }
  for (const r of data.activity) {
    add("steps", r.steps, r.day);
    if (isNumber(r.high_activity_time) && isNumber(r.medium_activity_time)) add("active_minutes", Math.round((r.high_activity_time + r.medium_activity_time) / 60), r.day);
  }
  for (const r of data.spo2) add("spo2_percent", asRecord(r.spo2_percentage).average, r.day);
  for (const r of data.vo2) add("vo2_max", r.vo2_max, r.day);
  return out;
}

export const oura: WearableProvider = {
  id: "oura",
  label: "Oura",
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
    return tokens({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret });
  },
  async fetchReadings(accessToken, from, to) {
    return fetchOura(accessToken, from, to, false);
  },
};

/** Exported so the mapping can be checked against Oura's public sandbox, which accepts any token. */
export async function fetchOura(accessToken: string, from: string, to: string, sandbox: boolean): Promise<DailyReading[]> {
  const get = async (name: string) => (await collection(accessToken, name, from, to, sandbox)) ?? [];
  const [sleepScores, readiness, sleepPeriods, activity, spo2, vo2] = await Promise.all([
    get("daily_sleep"),
    get("daily_readiness"),
    get("sleep"),
    get("daily_activity"),
    get("daily_spo2"),
    get("vO2_max"),
  ]);
  return mapOura({ sleepScores, readiness, sleepPeriods, activity, spo2, vo2 });
}
