import { NextResponse, type NextRequest } from "next/server";

import { INVITE_COOKIE, INVITE_COOKIE_PATH } from "@/lib/invitations/lookup";
import { cleanToken } from "@/lib/invitations/token";

/**
 * The address in an invitation email. It moves the token into a cookie and sends the person on, so
 * the token does not stay in the address bar, the history or a referrer. It reads nothing from
 * the database and uses nothing up, so a mail scanner that opens the link harms nobody.
 */
export function GET(request: NextRequest) {
  const token = cleanToken(request.nextUrl.searchParams.get("token"));
  const destination = request.nextUrl.clone();
  destination.pathname = "/invite/accept";
  destination.search = "";

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (token) {
    response.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: INVITE_COOKIE_PATH,
      maxAge: 60 * 60,
    });
  }
  return response;
}
