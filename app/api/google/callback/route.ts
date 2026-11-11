import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { GOOGLE_STATE_COOKIE } from "@/lib/calendar/constants";
import { encryptToken } from "@/lib/calendar/crypto";
import { exchangeCode, revokeToken, WRONG_ACCOUNT } from "@/lib/calendar/google";
import { createAdminClient } from "@/lib/supabase/admin";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Google sends the staff member back here. The state must match the cookie set when they
 * left, for the same signed-in person, before the code is exchanged. The refresh token is
 * encrypted before it is stored, and never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const back = (outcome: string) => {
    const response = NextResponse.redirect(new URL(`/clinic/calendar?${outcome}`, request.url));
    response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return response;
  };

  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const cookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  const [cookieUser, cookieNonce] = cookie.split(".");
  if (!cookieNonce || cookieUser !== user.id || !sameValue(state, cookieNonce)) return back("error=expired");

  // They pressed Cancel on Google's screen.
  if (params.get("error")) return back("error=cancelled");
  const code = params.get("code");
  if (!code) return back("error=failed");

  try {
    const connected = await exchangeCode(code);
    const admin = createAdminClient();
    const { error } = await admin.rpc("save_google_calendar_connection", {
      _user: user.id,
      _google_email: connected.email,
      _refresh_token_encrypted: encryptToken(connected.refreshToken, user.id),
      _scope: connected.scope,
    });
    if (error) {
      await revokeToken(connected.refreshToken);
      console.error("Google Calendar connection was not saved.");
      return back("error=failed");
    }
    // A reconnect overwrites the stored token without revoking the old one at Google: Google
    // revokes the whole grant for any of its tokens, which would also kill the new one.
    return back("connected=1");
  } catch (error) {
    // The message names the step, never a token or code.
    console.error(`Google Calendar connection failed: ${error instanceof Error ? error.message : "unknown"}`);
    const message = error instanceof Error ? error.message : "";
    if (message === "Calendar access was not granted.") return back("error=no-calendar");
    if (message === WRONG_ACCOUNT) return back("error=wrong-account");
    return back("error=failed");
  }
}
