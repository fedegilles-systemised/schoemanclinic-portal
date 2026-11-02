import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { LAST_SEEN_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_KIND_COOKIE } from "@/lib/supabase/session-cookies";

const ALLOWED_NEXT = ["/update-password", "/portal", "/clinic", "/"];
const OTP_TYPES: readonly EmailOtpType[] = ["recovery", "invite", "email", "email_change"];

function isOtpType(value: string | null): value is EmailOtpType {
  return OTP_TYPES.includes(value as EmailOtpType);
}

/** A verified link is a new session: staff limits apply until the kind is known. */
async function startNewSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LAST_SEEN_COOKIE, String(Math.floor(Date.now() / 1000)), SESSION_COOKIE_OPTIONS);
  cookieStore.delete(SESSION_KIND_COOKIE);
}

/** Confirms an emailed link. `next` is checked against a list, so it cannot redirect off-site. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/";
  const next = ALLOWED_NEXT.includes(requestedNext) ? requestedNext : "/";

  const supabase = await createClient();

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await startNewSession();
      redirect(next);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await startNewSession();
      redirect(next);
    }
  }

  redirect("/login?error=link");
}
