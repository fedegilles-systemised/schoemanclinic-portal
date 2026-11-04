"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { newPasswordSchema, PASSWORD_RULES_MESSAGE } from "@/lib/auth/password-rules";
import { getCurrentUser } from "@/lib/auth/session";
import { startSessionCookies } from "@/lib/auth/session-start";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { INVITE_COOKIE, INVITE_COOKIE_PATH, lookupInvitation, readInviteToken } from "@/lib/invitations/lookup";
import type { InvitationKind } from "@/lib/invitations/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AcceptFormState = { error?: string };

const TRY_LATER = "Too many attempts. Please wait a few minutes and try again.";
const GENERIC_FAILURE = "We could not do that. Please try again.";
const NOT_VALID = "This invitation is no longer valid. Ask the clinic to send you a new one.";
const SIGN_IN_FAILED = "We could not sign you in. Check your password and try again.";

/** Where a person starts once the invitation is accepted. */
function homeFor(kind: InvitationKind): "/clinic" | "/portal" {
  return kind === "team" ? "/clinic" : "/portal";
}

async function clearInviteCookie(): Promise<void> {
  (await cookies()).set(INVITE_COOKIE, "", { path: INVITE_COOKIE_PATH, maxAge: 0 });
}

function databaseMessage(error: { code?: string; message: string }): string {
  return ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : GENERIC_FAILURE;
}

/**
 * Patient and guardian invitations also need the patient's date of birth, so a link that
 * reached the wrong inbox does not open a record. Wrong dates are counted by the database;
 * the fifth cancels the link.
 */
async function checkIdentity(info: { kind: InvitationKind; hash: string }, formData: FormData): Promise<string | null> {
  if (info.kind === "team") return null;
  const raw = String(formData.get("dob") ?? "");
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  const { data, error } = await createAdminClient().rpc("verify_invitation_identity", {
    _token_hash: info.hash,
    _date_of_birth: dob ?? undefined,
  });
  if (error) return GENERIC_FAILURE;
  if (data === "ok") return null;
  if (data === "locked") return "That was the fifth date that did not match, so this invitation has been cancelled. Please ask the clinic to send you a new one.";
  if (data === "wrong") return "The date of birth does not match. Check it and try again.";
  return NOT_VALID;
}

// A new account ------------------------------------------------------------------------

const createSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: "The passwords do not match.", path: ["confirm"] });

export async function createAccountFromInvitation(_state: AcceptFormState, formData: FormData): Promise<AcceptFormState> {
  const info = await lookupInvitation(await readInviteToken());
  if (info.status !== "valid" || info.accountExists) return { error: NOT_VALID };

  const parsed = createSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!newPasswordSchema.safeParse({ password: parsed.data.password }).success) return { error: PASSWORD_RULES_MESSAGE };
  if (!(await allowAuthAttempt("invitation-accept", info.hash.slice(0, 40)))) return { error: TRY_LATER };
  const identityProblem = await checkIdentity(info, formData);
  if (identityProblem) return { error: identityProblem };

  const admin = createAdminClient();
  // The address is confirmed because the link reached it: that is what an invitation proves.
  const created = await admin.auth.admin.createUser({
    email: info.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (created.error || !created.data.user) {
    if (created.error?.code === "email_exists") return { error: "An account already exists for this address. Reload the page to sign in." };
    if (created.error?.code === "weak_password") return { error: PASSWORD_RULES_MESSAGE };
    console.error(`Account for an invitation could not be created: ${created.error?.code ?? "no code"}.`);
    return { error: GENERIC_FAILURE };
  }
  const userId = created.data.user.id;

  const { error } = await admin.rpc("accept_invitation", {
    _token_hash: info.hash,
    _user_id: userId,
    _full_name: parsed.data.fullName,
    _date_of_birth: String(formData.get("dob") ?? "") || undefined,
  });
  if (error) return { error: databaseMessage(error) };

  // Sign in with the password just chosen, so the person lands in their portal.
  const supabase = await createClient();
  const signedIn = await supabase.auth.signInWithPassword({ email: info.email, password: parsed.data.password });
  if (signedIn.error) redirect("/login");
  await startSessionCookies(userId, info.kind === "team" ? "staff" : "patient");
  await clearInviteCookie();
  redirect(homeFor(info.kind));
}

// An account that already exists --------------------------------------------------------

export async function signInToAcceptInvitation(_state: AcceptFormState, formData: FormData): Promise<AcceptFormState> {
  const info = await lookupInvitation(await readInviteToken());
  if (info.status !== "valid" || !info.accountExists) return { error: NOT_VALID };

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: SIGN_IN_FAILED };
  if (!(await allowAuthAttempt("sign-in", info.email)) || !(await allowAuthAttempt("invitation-accept", info.hash.slice(0, 40)))) {
    return { error: TRY_LATER };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: info.email, password });
  if (error) return { error: error.status === 429 ? TRY_LATER : SIGN_IN_FAILED };

  const user = await getCurrentUser();
  // A suspended account cannot accept anything, and gets no session here.
  if (!user || user.isSuspended) {
    await supabase.auth.signOut();
    return { error: "This account does not have access. Please contact the clinic." };
  }
  await startSessionCookies(user.id, user.isStaff ? "staff" : "patient");
  // The page now shows the confirmation step, for the signed-in person.
  redirect("/invite/accept");
}

export async function acceptInvitationWhileSignedIn(_state: AcceptFormState, formData: FormData): Promise<AcceptFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended) redirect("/invite/accept");
  const info = await lookupInvitation(await readInviteToken());
  if (info.status !== "valid") return { error: NOT_VALID };
  if (info.email.toLowerCase() !== user.email.toLowerCase()) return { error: "Sign in with the address the invitation was sent to." };
  if (!(await allowAuthAttempt("invitation-accept", info.hash.slice(0, 40)))) return { error: TRY_LATER };

  const identityProblem = await checkIdentity(info, formData);
  if (identityProblem) return { error: identityProblem };

  const { error } = await createAdminClient().rpc("accept_invitation", {
    _token_hash: info.hash,
    _user_id: user.id,
    _date_of_birth: String(formData.get("dob") ?? "") || undefined,
  });
  if (error) return { error: databaseMessage(error) };

  await startSessionCookies(user.id, user.isStaff || info.kind === "team" ? "staff" : "patient");
  await clearInviteCookie();
  revalidatePath("/", "layout");
  redirect(homeFor(info.kind));
}

/** Signs the current person out and comes back to the invitation, for the right account. */
export async function signOutForInvitation(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/invite/accept");
}
