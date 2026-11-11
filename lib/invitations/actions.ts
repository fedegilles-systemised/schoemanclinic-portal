"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getEmailEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { invitationEmail, teamInviteAlertEmail } from "@/lib/email/templates/app";
import {
  INVITATION_DAYS,
  kindsFor,
  RELATIONSHIPS,
  TEAM_INVITE_ALERT_TO,
  TEAM_ROLES,
  type InvitationKind,
} from "@/lib/invitations/constants";
import { generateToken, hashToken } from "@/lib/invitations/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InvitationFormState = { error?: string; saved?: string; needsConfirm?: boolean };

const GENERIC_FAILURE = "We could not do that. Please try again.";
const TRY_LATER = "Too many attempts. Please wait a few minutes and try again.";

/** Only PAs and admins reach these actions. The database checks again, by name, on every call. */
async function requireInviter(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || kindsFor(user.roles).length === 0) redirect("/clinic");
  return user;
}

/** The database's own messages for a refused invitation are written for people. Others are not shown. */
function friendly(error: { code?: string; message: string }): string {
  return ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : GENERIC_FAILURE;
}

const baseFields = {
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  fullName: z.string().trim().max(120, "Use 120 characters or fewer.").optional(),
};

const patientFields = {
  patientMode: z.enum(["existing", "new"]),
  patientId: z.string().optional(),
  newFirstName: z.string().trim().max(60).optional(),
  newLastName: z.string().trim().max(60).optional(),
  newDob: z.string().optional(),
};

const sendSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("patient"), ...baseFields, ...patientFields }),
  z.object({
    kind: z.literal("guardian"),
    ...baseFields,
    ...patientFields,
    relationship: z.enum(RELATIONSHIPS, "Say how the guardian is related."),
    canAct: z.boolean(),
  }),
  z.object({
    kind: z.literal("team"),
    ...baseFields,
    role: z.enum(TEAM_ROLES, "Choose a team role."),
    jobTitle: z.string().trim().max(120, "Use 120 characters or fewer.").optional(),
  }),
]);

function readForm(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return {
    kind: text("kind"),
    email: text("email") ?? "",
    fullName: text("fullName") || undefined,
    patientMode: text("patientMode") ?? "existing",
    patientId: text("patientId") || undefined,
    newFirstName: text("newFirstName") || undefined,
    newLastName: text("newLastName") || undefined,
    newDob: text("newDob") || undefined,
    relationship: text("relationship"),
    canAct: formData.get("canAct") === "on",
    role: text("role"),
    jobTitle: text("jobTitle") || undefined,
  };
}

function confirmedMismatch(formData: FormData): boolean {
  return formData.get("confirmMismatch") === "on";
}

const newPatientSchema = z.object({
  first_name: z.string().min(1, "Enter the patient's first name.").max(60),
  last_name: z.string().min(1, "Enter the patient's last name.").max(60),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of birth.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.getTime() < Date.now() && date.getUTCFullYear() >= 1900;
    }, "Enter a valid date of birth."),
});

/** Sends the email for an invitation that exists. A failure here leaves the invitation to be resent. */
async function deliver(params: {
  to: string;
  kind: InvitationKind;
  firstName?: string;
  inviterName: string;
  token: string;
}): Promise<string | null> {
  let env: ReturnType<typeof getEmailEnv>;
  try {
    env = getEmailEnv();
  } catch {
    console.error("Invitation email not sent: the email settings are missing.");
    return "The invitation was saved, but email is not set up on this site. Ask the technical team to set it up, then use Resend.";
  }
  const acceptUrl = `${env.SITE_URL.replace(/\/$/, "")}/invite?token=${params.token}`;
  const result = await sendEmail({
    to: params.to,
    ...invitationEmail({
      siteUrl: env.SITE_URL.replace(/\/$/, ""),
      firstName: params.firstName,
      inviterName: params.inviterName,
      audience: params.kind,
      acceptUrl,
      expiresInDays: INVITATION_DAYS,
    }),
  });
  if (!result.ok) {
    console.error(`Invitation email failed: ${result.error}`);
    return "The invitation was saved, but the email could not be sent. Use Resend to try again.";
  }
  return null;
}

/**
 * Tells the clinic's lead that a doctor or an admin was invited. Never blocks the invitation: a
 * failure is logged, and the portal bell notice to the other admins still stands.
 */
async function alertTeamInvite(params: { inviterName: string; invitedEmail: string; role: "doctor" | "admin" }): Promise<void> {
  try {
    const env = getEmailEnv();
    const siteUrl = env.SITE_URL.replace(/\/$/, "");
    const result = await sendEmail({
      to: TEAM_INVITE_ALERT_TO,
      ...teamInviteAlertEmail({
        siteUrl,
        inviterName: params.inviterName || "A colleague",
        invitedEmail: params.invitedEmail,
        roleLabel: params.role === "admin" ? "Admin" : "Doctor",
        teamUrl: `${siteUrl}/clinic/team`,
      }),
    });
    if (!result.ok) console.error(`Team invitation alert failed: ${result.error}`);
  } catch {
    console.error("Team invitation alert not sent: the email settings are missing.");
  }
}

function firstWord(name: string | undefined): string | undefined {
  return name?.split(/\s+/)[0] || undefined;
}

export async function sendInvitation(_state: InvitationFormState, formData: FormData): Promise<InvitationFormState> {
  const user = await requireInviter();
  const parsed = sendSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const input = parsed.data;
  if (!kindsFor(user.roles).includes(input.kind)) return { error: "You cannot send this kind of invitation." };

  let newPatient: { first_name: string; last_name: string; date_of_birth: string } | null = null;
  if (input.kind !== "team") {
    if (input.patientMode === "new") {
      const details = newPatientSchema.safeParse({
        first_name: input.newFirstName ?? "",
        last_name: input.newLastName ?? "",
        date_of_birth: input.newDob ?? "",
      });
      if (!details.success) return { error: details.error.issues[0]?.message ?? GENERIC_FAILURE };
      newPatient = details.data;
    } else if (!input.patientId || !z.uuid().safeParse(input.patientId).success) {
      return { error: "Choose a patient." };
    }
  }

  if (!(await allowAuthAttempt("invitation-send", user.email))) return { error: TRY_LATER };

  const token = generateToken();
  const { error } = await createAdminClient().rpc("create_invitation", {
    _inviter: user.id,
    _kind: input.kind,
    _email: input.email,
    _full_name: input.fullName ?? (newPatient ? `${newPatient.first_name} ${newPatient.last_name}` : undefined),
    _role: input.kind === "team" ? input.role : input.kind === "patient" ? "patient" : undefined,
    _patient_id: input.kind !== "team" && input.patientMode === "existing" ? input.patientId : undefined,
    _relationship: input.kind === "guardian" ? input.relationship : undefined,
    _can_act: input.kind === "guardian" ? input.canAct : undefined,
    _job_title: input.kind === "team" ? input.jobTitle : undefined,
    _token_hash: hashToken(token),
    _new_patient: newPatient ?? undefined,
    _confirm_email_mismatch: confirmedMismatch(formData),
  });
  // The address differs from the clinic's record: the sender decides, with the warning in front of them.
  if (error?.hint === "email_mismatch") return { error: friendly(error), needsConfirm: true };
  if (error) return { error: friendly(error) };

  revalidatePath("/clinic/team");
  const problem = await deliver({
    to: input.email,
    kind: input.kind,
    firstName: firstWord(input.fullName ?? newPatient?.first_name),
    inviterName: user.fullName,
    token,
  });
  if (input.kind === "team" && (input.role === "doctor" || input.role === "admin")) {
    await alertTeamInvite({ inviterName: user.fullName, invitedEmail: input.email, role: input.role });
  }
  return problem ? { error: problem } : { saved: `Invitation sent to ${input.email}.` };
}

const idSchema = z.uuid();

export async function resendInvitation(_state: InvitationFormState, formData: FormData): Promise<InvitationFormState> {
  const user = await requireInviter();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: GENERIC_FAILURE };
  if (!(await allowAuthAttempt("invitation-send", user.email))) return { error: TRY_LATER };

  // Read through the person's own session: they can only resend what they are allowed to see.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invitations")
    .select("email, kind, full_name")
    .eq("id", id.data)
    .maybeSingle();
  if (!existing) return { error: "That invitation was not found." };

  const token = generateToken();
  const { error } = await createAdminClient().rpc("resend_invitation", {
    _inviter: user.id,
    _invitation: id.data,
    _token_hash: hashToken(token),
  });
  if (error) return { error: friendly(error) };

  revalidatePath("/clinic/team");
  const problem = await deliver({
    to: existing.email,
    kind: existing.kind,
    firstName: firstWord(existing.full_name ?? undefined),
    inviterName: user.fullName,
    token,
  });
  return problem ? { error: problem } : { saved: `A new invitation was sent to ${existing.email}.` };
}

export async function cancelInvitation(_state: InvitationFormState, formData: FormData): Promise<InvitationFormState> {
  const user = await requireInviter();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: GENERIC_FAILURE };

  const { error } = await createAdminClient().rpc("revoke_invitation", { _inviter: user.id, _invitation: id.data });
  if (error) return { error: friendly(error) };

  revalidatePath("/clinic/team");
  return { saved: "The invitation was cancelled." };
}
