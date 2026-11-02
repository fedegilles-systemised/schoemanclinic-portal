import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, homePathFor } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · The Schoeman Clinic" };

const ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. Request a new one.",
  "no-access": "This account does not have access. Please contact the clinic.",
  expired: "You were signed out to protect your account. Please sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  const home = user ? homePathFor(user) : null;
  if (home) redirect(home);

  const { error } = await searchParams;
  return <LoginForm initialError={error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined} />;
}
