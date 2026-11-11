import "server-only";

import { decryptToken } from "@/lib/calendar/crypto";
import { getGoogleEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calls to Google for the staff Calendar screen. Everything here runs on the server: the
 * browser never sees a Google token, and the page's Content-Security-Policy is unchanged.
 */

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"] as const;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3";
// No call to Google may hold a page or an action open indefinitely.
const TIMEOUT_MS = 10_000;

export const CLINIC_TIME_ZONE = "Europe/London";

/** The message exchangeCode throws for an account outside GOOGLE_WORKSPACE_DOMAIN. */
export const WRONG_ACCOUNT = "The Google account is not in the clinic's domain.";

/** Google no longer accepts the stored token: the person revoked it, or it expired. */
export class GoogleDisconnectedError extends Error {}
/** Any other refusal from Google. The message is for logs, never shown as it is. */
export class GoogleRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function callbackUrl(): string {
  return `${getGoogleEnv().SITE_URL.replace(/\/$/, "")}/api/google/callback`;
}

/** The address a staff member is sent to, to let Clinic Hub use their calendar. */
export function authorisationUrl(state: string): string {
  const env = getGoogleEnv();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // A refresh token, so the calendar keeps working after the page is closed. Asking for
    // consent every time makes Google send one even to someone who connected before.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  // A hint only: Google shows accounts in the clinic's domain. exchangeCode enforces it.
  if (env.GOOGLE_WORKSPACE_DOMAIN) params.set("hd", env.GOOGLE_WORKSPACE_DOMAIN);
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; scope?: string; error?: string };

async function postToken(body: Record<string, string>): Promise<TokenResponse & { ok: boolean; status: number }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  return { ...json, ok: response.ok, status: response.status };
}

export type Connected = { refreshToken: string; scope: string; email: string };

/** Swaps the code from the callback for tokens, and checks the calendar was actually granted. */
export async function exchangeCode(code: string): Promise<Connected> {
  const env = getGoogleEnv();
  const token = await postToken({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackUrl(),
    grant_type: "authorization_code",
  });
  if (!token.ok || !token.access_token) throw new GoogleRequestError(`Token exchange failed: ${token.error ?? "unknown"}`, token.status);
  if (!token.refresh_token) throw new GoogleRequestError("Google sent no refresh token.", 400);
  const scope = token.scope ?? "";
  if (!scope.split(" ").includes(CALENDAR_SCOPE)) {
    // They unticked the calendar on Google's screen. Give the token straight back.
    await revokeToken(token.refresh_token);
    throw new GoogleRequestError("Calendar access was not granted.", 403);
  }
  const info = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const user = (await info.json().catch(() => ({}))) as { email?: string; email_verified?: boolean; hd?: string };
  if (!info.ok || !user.email || user.email_verified !== true) {
    await revokeToken(token.refresh_token);
    throw new GoogleRequestError("Could not read a verified email for the Google account.", info.status);
  }
  const domain = env.GOOGLE_WORKSPACE_DOMAIN?.toLowerCase();
  if (domain && user.hd?.toLowerCase() !== domain) {
    await revokeToken(token.refresh_token);
    throw new GoogleRequestError(WRONG_ACCOUNT, 403);
  }
  return { refreshToken: token.refresh_token, scope, email: user.email };
}

async function accessTokenFor(refreshToken: string): Promise<string> {
  const env = getGoogleEnv();
  const token = await postToken({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  if (token.error === "invalid_grant") throw new GoogleDisconnectedError("Google refused the stored token.");
  if (!token.ok || !token.access_token) throw new GoogleRequestError(`Token refresh failed: ${token.error ?? "unknown"}`, token.status);
  return token.access_token;
}

/** Best effort: a token Google has already dropped is not an error here. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined);
}

type Session = { accessToken: string; calendarId: string };

/**
 * The signed-in staff member's Google access, or null if they have not connected. Uses the
 * service role only to read their own encrypted token: callers pass the id of the person
 * already checked by getCurrentUser, never an id from a form.
 */
export async function googleSessionFor(userId: string): Promise<Session | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("refresh_token_encrypted, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not read the calendar connection.");
  if (!data) return null;
  let refreshToken: string;
  try {
    refreshToken = decryptToken(data.refresh_token_encrypted, userId);
  } catch {
    // Most likely GOOGLE_TOKEN_ENCRYPTION_KEY was changed. Not treated as a disconnection, so a
    // wrong key in one deployment does not wipe everyone's connection as they open the page.
    throw new Error("The stored token could not be decrypted.");
  }
  return { accessToken: await accessTokenFor(refreshToken), calendarId: data.calendar_id };
}

/** Revokes at Google and deletes the stored token. */
export async function disconnect(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    try {
      await revokeToken(decryptToken(data.refresh_token_encrypted, userId));
    } catch {
      // Unreadable token: nothing to revoke, but the row still goes.
    }
  }
  const { error } = await admin.rpc("remove_google_calendar_connection", { _user: userId });
  if (error) throw new Error("Could not remove the calendar connection.");
}

// Events -----------------------------------------------------------------------------------

type GoogleTime = { dateTime?: string; date?: string; timeZone?: string };
type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  recurringEventId?: string;
  start?: GoogleTime;
  end?: GoogleTime;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  link: string | null;
  allDay: boolean;
  /** One occurrence of a repeating event: a change here touches that occurrence only. */
  repeating: boolean;
  /** ISO date-time with offset, or a date for all-day events. */
  start: string;
  end: string;
};

async function calendarFetch(session: Session, path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${CALENDAR_URL}/calendars/${encodeURIComponent(session.calendarId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) throw new GoogleDisconnectedError("Google refused the access token.");
  return response;
}

function toEvent(item: GoogleEvent): CalendarEvent | null {
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;
  if (!start || !end || item.status === "cancelled") return null;
  return {
    id: item.id,
    title: item.summary ?? "(No title)",
    description: item.description ?? "",
    location: item.location ?? "",
    // Only ever a link into Google Calendar, whatever the response holds.
    link: item.htmlLink?.startsWith("https://www.google.com/calendar/") ? item.htmlLink : null,
    allDay: !item.start?.dateTime,
    repeating: Boolean(item.recurringEventId),
    start,
    end,
  };
}

/** Events between two instants, repeating events expanded, earliest first. */
export async function listEvents(session: Session, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  // A week rarely needs more than one page; the cap stops a runaway loop.
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeZone: CLINIC_TIME_ZONE,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await calendarFetch(session, `/events?${params.toString()}`);
    if (!response.ok) throw new GoogleRequestError("Could not list events.", response.status);
    const json = (await response.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    for (const item of json.items ?? []) {
      const event = toEvent(item);
      if (event) events.push(event);
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return events;
}

export type EventInput = {
  title: string;
  description: string;
  location: string;
  /** Wall-clock times in the clinic's time zone, `YYYY-MM-DDTHH:MM:00`. */
  start: string;
  end: string;
};

function eventBody(input: EventInput) {
  return {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
    start: { dateTime: input.start, timeZone: CLINIC_TIME_ZONE },
    end: { dateTime: input.end, timeZone: CLINIC_TIME_ZONE },
  };
}

export async function createEvent(session: Session, input: EventInput): Promise<void> {
  const response = await calendarFetch(session, "/events", { method: "POST", body: JSON.stringify(eventBody(input)) });
  if (!response.ok) throw new GoogleRequestError("Could not add the event.", response.status);
}

export async function updateEvent(session: Session, eventId: string, input: EventInput): Promise<void> {
  const body = eventBody(input);
  // PATCH, so fields this screen does not show (attendees, reminders, colour) are kept.
  const response = await calendarFetch(session, `/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...body, description: input.description, location: input.location }),
  });
  if (!response.ok) throw new GoogleRequestError("Could not change the event.", response.status);
}

export async function deleteEvent(session: Session, eventId: string): Promise<void> {
  const response = await calendarFetch(session, `/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  // 410: already deleted in Google, which is what was wanted.
  if (!response.ok && response.status !== 410) throw new GoogleRequestError("Could not delete the event.", response.status);
}
