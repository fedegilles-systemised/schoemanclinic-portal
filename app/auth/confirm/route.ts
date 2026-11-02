import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/update-password", "/portal", "/clinic", "/"];
const OTP_TYPES: readonly EmailOtpType[] = ["recovery", "invite", "email", "email_change"];

function isOtpType(value: string | null): value is EmailOtpType {
  return OTP_TYPES.includes(value as EmailOtpType);
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
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/login?error=link");
}
