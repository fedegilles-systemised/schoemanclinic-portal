import "server-only";

import { cookies } from "next/headers";

import {
  LAST_SEEN_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_KIND_COOKIE,
  signSessionValue,
} from "@/lib/supabase/session-cookies";
import type { SessionKind } from "@/lib/supabase/session-limits";

/**
 * Starts the idle clock and says which session limits apply, in cookies that only the
 * server can sign. With no kind, staff limits apply until the person signs in again.
 */
export async function startSessionCookies(userId: string, kind: SessionKind | null): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    LAST_SEEN_COOKIE,
    await signSessionValue(LAST_SEEN_COOKIE, String(Math.floor(Date.now() / 1000)), userId),
    SESSION_COOKIE_OPTIONS,
  );
  if (kind) {
    cookieStore.set(SESSION_KIND_COOKIE, await signSessionValue(SESSION_KIND_COOKIE, kind, userId), SESSION_COOKIE_OPTIONS);
  } else {
    cookieStore.delete(SESSION_KIND_COOKIE);
  }
}
