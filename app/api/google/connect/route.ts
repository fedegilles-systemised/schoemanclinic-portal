import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { GOOGLE_STATE_COOKIE } from "@/lib/calendar/constants";
import { authorisationUrl } from "@/lib/calendar/google";
import { isGoogleConfigured } from "@/lib/env";

/**
 * Sends a signed-in staff member to Google to allow access to their calendar. A link, not a
 * form, so the page's form-action policy does not block the hop to Google. The state value
 * ties the callback to this person and this browser, and stops a forged callback.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/clinic/calendar?error=not-set-up", request.url));
  }

  const nonce = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(authorisationUrl(nonce));
  response.cookies.set(GOOGLE_STATE_COOKIE, `${user.id}.${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: Google's redirect back is a top-level GET, which still carries it.
    sameSite: "lax",
    path: "/api/google",
    maxAge: 10 * 60,
  });
  return response;
}
