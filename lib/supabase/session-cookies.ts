/**
 * Cookie settings and session limits, shared by the server client and the proxy.
 * Supabase's own time-box and inactivity settings need its Pro plan, so the proxy
 * enforces these. The limits are hours and minutes on purpose: see docs/SECURITY.md,
 * S-31, for what an app-level limit cannot stop.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export type SessionKind = "staff" | "patient";

export const SESSION_LIMITS: Record<SessionKind, { totalSeconds: number; idleSeconds: number }> = {
  staff: { totalSeconds: 12 * HOUR, idleSeconds: 30 * MINUTE },
  patient: { totalSeconds: 7 * 24 * HOUR, idleSeconds: 2 * HOUR },
};

/** Long enough for the longest session. The limits above end a session sooner. */
const COOKIE_MAX_AGE_SECONDS = SESSION_LIMITS.patient.totalSeconds;

const CLOCK_SKEW_SECONDS = MINUTE;

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

/** An unknown kind gets the stricter limits. */
export function parseSessionKind(value: string | undefined): SessionKind {
  return value === "patient" ? "patient" : "staff";
}

export function isSessionExpired({
  kind,
  authenticatedAt,
  lastSeen,
  now,
}: {
  kind: SessionKind;
  authenticatedAt: number;
  lastSeen: number | null;
  now: number;
}): boolean {
  const limits = SESSION_LIMITS[kind];
  if (now - authenticatedAt > limits.totalSeconds) return true;
  // Every sign-in sets last-seen, so a missing or future value is not to be trusted.
  if (lastSeen === null || lastSeen > now + CLOCK_SKEW_SECONDS) return true;
  return now - lastSeen > limits.idleSeconds;
}
