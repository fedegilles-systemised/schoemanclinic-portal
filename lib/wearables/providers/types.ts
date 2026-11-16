import type { WearableProviderId } from "@/lib/env";
import type { WearableMetric } from "@/lib/wearables/metrics";

/** One day's figure for one metric, already in the units Clinic Hub keeps. */
export type DailyReading = { metric: WearableMetric; value: number; measuredOn: string };

export type TokenSet = { accessToken: string; refreshToken: string; expiresAt: Date; scope: string };

/** The provider no longer accepts the link: the patient has to connect again. */
export class ProviderAuthError extends Error {}

export interface WearableProvider {
  id: WearableProviderId;
  label: string;
  /** Where the patient goes to allow access. `state` ties the callback to their browser. */
  authorisationUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  /** Refresh tokens are used once: the answer holds the next one, which must be stored. */
  refresh(refreshToken: string): Promise<TokenSet>;
  /** Daily figures from `from` to `to`, both days included, as YYYY-MM-DD. */
  fetchReadings(accessToken: string, from: string, to: string): Promise<DailyReading[]>;
  /** Asks the provider to end the link, where it lets us. Best effort. */
  revoke?(accessToken: string): Promise<void>;
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A calendar day in London, which is the day a patient means by "last night's sleep". */
export function londonDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** A request to a provider, with a time limit so a slow answer cannot hold up the daily run. */
export async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: "no-store" });
}
