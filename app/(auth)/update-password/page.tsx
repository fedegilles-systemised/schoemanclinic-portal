import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Choose a new password · The Schoeman Clinic" };

/** Reached from the emailed link, which sets the session first. */
export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=link");
  return <UpdatePasswordForm />;
}
