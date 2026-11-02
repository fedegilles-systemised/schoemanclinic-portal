"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // React resets the form after an action, so the email comes back to refill the field.
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: SIGN_IN_FAILED, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: SIGN_IN_FAILED, email };

  const user = await getCurrentUser();
  const home = user ? homePathFor(user) : null;
  if (!home) {
    await supabase.auth.signOut();
    return { error: NO_ACCESS, email };
  }
  redirect(home);
}

export async function requestPasswordReset(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter your email address, like you@example.com." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? undefined;
  // The result is ignored on purpose: the reply is the same whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: origin ? `${origin}/auth/confirm?next=/update-password` : undefined,
  });
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
  redirect((user && homePathFor(user)) ?? "/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
