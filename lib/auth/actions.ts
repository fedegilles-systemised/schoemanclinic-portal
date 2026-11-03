"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, homePathFor, type CurrentUser } from "@/lib/auth/session";
import { parseReturnPath } from "@/lib/auth/next-path";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { createClient } from "@/lib/supabase/server";
import { LAST_SEEN_COOKIE, SESSION_KIND_COOKIE } from "@/lib/supabase/session-cookies";
import { startSessionCookies } from "@/lib/auth/session-start";

export type AuthFormState = { error?: string; sent?: boolean; email?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const newPassword = z.object({
  password: z
    .string()
    .min(12)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

// One message for every failure, so the form never reveals whether an account exists.
const SIGN_IN_FAILED = "We could not sign you in. Check your email and password and try again.";
const NO_ACCESS = "This account does not have access. Please contact the clinic.";
// Says nothing about the account: the limits apply whether or not it exists.
const TRY_LATER = "Too many attempts. Please wait a few minutes and try again.";

/** Sets which session limits apply. Staff limits win for someone who is also a patient. */
async function recordSessionKind(user: CurrentUser): Promise<void> {
  await startSessionCookies(user.id, user.isStaff ? "staff" : "patient");
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // React resets the form after an action, so the email comes back to refill the field.
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: SIGN_IN_FAILED, email };
  if (!(await allowAuthAttempt("sign-in", parsed.data.email))) return { error: TRY_LATER, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.status === 429 ? TRY_LATER : SIGN_IN_FAILED, email };

  const user = await getCurrentUser();
  const home = user ? homePathFor(user) : null;
  if (!user || !home) {
    await supabase.auth.signOut();
    return { error: NO_ACCESS, email };
  }
  await recordSessionKind(user);
  const returnPath = parseReturnPath(formData.get("next"));
  redirect(returnPath && user.isAdmin ? returnPath : home);
}

export async function requestPasswordReset(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter your email address, like you@example.com." };
  if (!(await allowAuthAttempt("password-reset", email.data))) return { error: TRY_LATER };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: origin ? `${origin}/auth/confirm?next=/update-password` : undefined,
  });
  // Every result gets the same reply, whether or not the account exists. Supabase's email
  // limits apply only to real accounts, so even its 429 must not show on the screen.
  if (error) console.error(`Password reset email failed: ${error.status ?? "no status"} ${error.code ?? "no code"}.`);
  return { sent: true };
}

export async function updatePassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPassword.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Use at least 12 characters, with a lower-case letter, a capital and a number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you have not used on this account."
          : "We could not update your password. Request a new link and try again.",
    };
  }

  const user = await getCurrentUser();
  if (user) await recordSessionKind(user);
  redirect((user && homePathFor(user)) ?? "/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(LAST_SEEN_COOKIE);
  cookieStore.delete(SESSION_KIND_COOKIE);
  redirect("/login");
}
