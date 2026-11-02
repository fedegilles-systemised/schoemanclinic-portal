/**
 * Session limits. Supabase's own time-box and inactivity settings need its Pro plan, so
 * the proxy enforces these. They are hours and minutes on purpose: see docs/SECURITY.md,
 * S-31, for what an app-level limit cannot stop. No secrets here: the browser imports it.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export type SessionKind = "staff" | "patient";

export const SESSION_LIMITS: Record<SessionKind, { totalSeconds: number; idleSeconds: number }> = {
  staff: { totalSeconds: 12 * HOUR, idleSeconds: 30 * MINUTE },
  patient: { totalSeconds: 7 * 24 * HOUR, idleSeconds: 2 * HOUR },
};

const CLOCK_SKEW_SECONDS = MINUTE;

/** An unknown kind gets the stricter limits. */
export function parseSessionKind(value: string | null | undefined): SessionKind {
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
