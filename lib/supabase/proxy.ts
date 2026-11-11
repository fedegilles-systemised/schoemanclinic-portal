import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy, createNonce } from "@/lib/csp";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";
import {
  AUTH_COOKIE_OPTIONS,
  LAST_SEEN_COOKIE,
  readSessionValue,
  SESSION_COOKIE_OPTIONS,
  SESSION_KIND_COOKIE,
  signSessionValue,
  withSessionMaxAge,
} from "@/lib/supabase/session-cookies";
import { parseReturnPath } from "@/lib/auth/next-path";
import { isSessionExpired, parseSessionKind } from "@/lib/supabase/session-limits";

const PROTECTED_PREFIXES = ["/portal", "/clinic", "/knowledge-base"];
// An emailed link starts a new session, so an old session must not stop it. The route
// resets the session cookies once the link verifies; a bad link changes nothing here.
const NEW_SESSION_PATH = "/auth/confirm";
// Avoids a cookie write on every request.
const LAST_SEEN_RESOLUTION_SECONDS = 60;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The latest sign-in time in the token. Refreshing a token does not change it. */
function authenticatedAt(claims: { amr?: unknown; iat?: number }, now: number): number {
  const times = Array.isArray(claims.amr)
    ? claims.amr.flatMap((entry: { timestamp?: unknown }) =>
        typeof entry?.timestamp === "number" ? [entry.timestamp] : [],
      )
    : [];
  return times.length > 0 ? Math.max(...times) : (claims.iat ?? now);
}

/**
 * Refreshes the session, ends one past its limits, redirects signed-out visitors and
 * sets the page's Content-Security-Policy with a fresh nonce. It does nothing else:
 * authorisation lives in the server layouts and, above all, in row-level security.
 */
export async function updateSession(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);

  // Built when needed, so it carries the cookies the refresh has just set.
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };
  const withCsp = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, withSessionMaxAge(options)),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it can sign
  // people out at random.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const pathname = request.nextUrl.pathname;

  if (!claims) {
    if (isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // A page on the return list brings the person back to it after they sign in.
      url.search = parseReturnPath(pathname) ? `?next=${encodeURIComponent(pathname)}` : "";
      return withCsp(NextResponse.redirect(url));
    }
    return withCsp(supabaseResponse);
  }

  if (pathname === NEW_SESSION_PATH) return withCsp(supabaseResponse);

  const now = Math.floor(Date.now() / 1000);
  // Unsigned or edited values read as missing, and a missing last-seen is an expired session.
  const lastSeenValue = await readSessionValue(LAST_SEEN_COOKIE, request.cookies.get(LAST_SEEN_COOKIE)?.value, claims.sub);
  const kindValue = await readSessionValue(SESSION_KIND_COOKIE, request.cookies.get(SESSION_KIND_COOKIE)?.value, claims.sub);
  const parsedLastSeen = lastSeenValue === null ? Number.NaN : Number(lastSeenValue);
  const lastSeen = Number.isFinite(parsedLastSeen) ? parsedLastSeen : null;

  const expired = isSessionExpired({
    // The clinic area always has staff limits, whatever the cookie says.
    kind: pathname === "/clinic" || pathname.startsWith("/clinic/") || pathname === "/knowledge-base" || pathname.startsWith("/knowledge-base/") || pathname.startsWith("/api/google/") ? "staff" : parseSessionKind(kindValue),
    authenticatedAt: authenticatedAt(claims, now),
    lastSeen,
    now,
  });

  if (expired) {
    await supabase.auth.signOut({ scope: "local" });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=expired";
    const redirect = NextResponse.redirect(url);
    // Cleared here too, so a failed sign-out cannot cause a redirect loop.
    request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith("sb-"))
      .forEach(({ name }) => redirect.cookies.delete(name));
    redirect.cookies.delete(LAST_SEEN_COOKIE);
    redirect.cookies.delete(SESSION_KIND_COOKIE);
    return withCsp(redirect);
  }

  if (lastSeen === null || now - lastSeen >= LAST_SEEN_RESOLUTION_SECONDS) {
    supabaseResponse.cookies.set(
      LAST_SEEN_COOKIE,
      await signSessionValue(LAST_SEEN_COOKIE, String(now), claims.sub),
      SESSION_COOKIE_OPTIONS,
    );
  }

  // Return this exact response object so the refreshed cookies reach the browser.
  return withCsp(supabaseResponse);
}
