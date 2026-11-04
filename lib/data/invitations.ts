import "server-only";

import type { InvitationKind, AppRole, GuardianRelationship } from "@/lib/invitations/constants";
import { createClient } from "@/lib/supabase/server";

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export type InvitationRow = {
  id: string;
  email: string;
  kind: InvitationKind;
  role: AppRole | null;
  patientName: string | null;
  relationship: GuardianRelationship | null;
  canAct: boolean | null;
  jobTitle: string | null;
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  status: InvitationStatus;
};

export type PatientOption = { id: string; name: string; clinicRef: string; hasAccount: boolean };

/** Patients for the invitation form: a name and a reference. No clinical data reaches the screen. */
export async function getPatientOptions(): Promise<PatientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitable_patients");
  if (error) throw new Error("Could not load the patient list.");
  return data.map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`,
    clinicRef: row.clinic_ref,
    hasAccount: row.has_account,
  }));
}

/** The invitations this person may see. The database decides which; a PA never gets team ones. */
export async function getInvitations(patients: PatientOption[]): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const [invitations, directory] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, kind, role, patient_id, relationship, can_act, job_title, invited_by, sent_at, expires_at, accepted_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("get_staff_directory"),
  ]);
  if (invitations.error) throw new Error("Could not load the invitations.");

  const names = new Map((directory.data ?? []).map((row) => [row.staff_id, row.full_name]));
  const patientNames = new Map(patients.map((patient) => [patient.id, patient.name]));
  const now = Date.now();

  return invitations.data.map((row) => ({
    id: row.id,
    email: row.email,
    kind: row.kind,
    role: row.role,
    patientName: row.patient_id ? (patientNames.get(row.patient_id) ?? null) : null,
    relationship: row.relationship,
    canAct: row.can_act,
    jobTitle: row.job_title,
    invitedBy: names.get(row.invited_by) ?? "A former team member",
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    status: row.accepted_at
      ? "accepted"
      : row.revoked_at
        ? "cancelled"
        : new Date(row.expires_at).getTime() <= now
          ? "expired"
          : "pending",
  }));
}
