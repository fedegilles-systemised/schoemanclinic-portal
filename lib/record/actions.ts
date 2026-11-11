"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { isDay, todayInLondon } from "@/lib/calendar/time";
import { getMyStaffId } from "@/lib/data/patient-record";
import { ALLERGY_SEVERITIES, DIAGNOSIS_STATUSES, SEVERITIES } from "@/lib/record/constants";
import { createClient } from "@/lib/supabase/server";

export type RecordFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const NOT_YOURS = "You cannot change this patient's record.";

type Role = "doctor" | "nurse" | "pa";

/** The roles each part allows; row-level security checks again, and checks the patient is theirs. */
async function requireRoleAndStaffId(roles: readonly Role[]) {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (roles as readonly string[]).includes(role))) redirect("/clinic");
  const staffId = await getMyStaffId(user.id);
  if (!staffId) redirect("/clinic");
  return staffId;
}

const optional = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => v || null);

function value(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** Doctors, nurses and PAs record an allergy. */
export async function addAllergy(_state: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const staffId = await requireRoleAndStaffId(["doctor", "nurse", "pa"]);
  const parsed = z
    .object({
      patientId: z.uuid(),
      substance: z.string().trim().min(1, "Name the substance.").max(120, "Use 120 characters or fewer."),
      reaction: optional(200, "Use 200 characters or fewer for the reaction."),
      severity: z.enum(ALLERGY_SEVERITIES).optional(),
    })
    .safeParse({ patientId: value(formData, "patientId"), substance: value(formData, "substance"), reaction: value(formData, "reaction"), severity: value(formData, "severity") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("patient_allergies").insert({
    patient_id: parsed.data.patientId,
    substance: parsed.data.substance,
    reaction: parsed.data.reaction,
    severity: parsed.data.severity ?? null,
    recorded_by: staffId,
  });
  if (error) return { error: error.code === "42501" ? NOT_YOURS : GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Allergy recorded.", sentAt: Date.now() };
}

/** Doctors record a diagnosis. */
export async function addDiagnosis(_state: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const staffId = await requireRoleAndStaffId(["doctor"]);
  const parsed = z
    .object({
      patientId: z.uuid(),
      label: z.string().trim().min(1, "Name the diagnosis.").max(160, "Use 160 characters or fewer."),
      icd10Code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/, "Use an ICD-10 code like E03.9, or leave it empty.")
        .optional(),
      status: z.enum(DIAGNOSIS_STATUSES),
      diagnosedOn: z
        .string()
        .refine((v) => isDay(v) && v <= todayInLondon(), "Choose a date that is not in the future.")
        .optional(),
      notes: optional(2000, "Use 2,000 characters or fewer for notes."),
    })
    .safeParse({
      patientId: value(formData, "patientId"),
      label: value(formData, "label"),
      icd10Code: value(formData, "icd10Code"),
      status: value(formData, "status") ?? "active",
      diagnosedOn: value(formData, "diagnosedOn"),
      notes: value(formData, "notes"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("diagnoses").insert({
    patient_id: parsed.data.patientId,
    label: parsed.data.label,
    icd10_code: parsed.data.icd10Code ?? null,
    status: parsed.data.status,
    diagnosed_on: parsed.data.diagnosedOn ?? null,
    notes: parsed.data.notes,
    recorded_by: staffId,
  });
  if (error) return { error: error.code === "42501" ? NOT_YOURS : GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Diagnosis recorded.", sentAt: Date.now() };
}

/** Doctors move a diagnosis on, for example to resolved. */
export async function setDiagnosisStatus(_state: RecordFormState, formData: FormData): Promise<RecordFormState> {
  await requireRoleAndStaffId(["doctor"]);
  const parsed = z
    .object({ patientId: z.uuid(), diagnosisId: z.uuid(), status: z.enum(DIAGNOSIS_STATUSES) })
    .safeParse({ patientId: value(formData, "patientId"), diagnosisId: value(formData, "diagnosisId"), status: value(formData, "status") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diagnoses")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.diagnosisId)
    .eq("patient_id", parsed.data.patientId)
    .select("id");
  if (error || !data?.length) return { error: NOT_YOURS };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Updated." };
}

/** Doctors raise a safeguarding alert. Nobody else ever sees it. */
export async function addSafeguardingAlert(_state: RecordFormState, formData: FormData): Promise<RecordFormState> {
  const staffId = await requireRoleAndStaffId(["doctor"]);
  const parsed = z
    .object({
      patientId: z.uuid(),
      alertType: z.string().trim().min(1, "Say what the concern is.").max(120, "Use 120 characters or fewer."),
      severity: z.enum(SEVERITIES, "Choose a severity."),
      note: z.string().trim().min(1, "Add a note.").max(4000, "Use 4,000 characters or fewer."),
      reviewDue: z
        .string()
        .refine((v) => isDay(v) && v >= todayInLondon(), "Choose a review date from today on.")
        .optional(),
    })
    .safeParse({
      patientId: value(formData, "patientId"),
      alertType: value(formData, "alertType"),
      severity: value(formData, "severity"),
      note: value(formData, "note"),
      reviewDue: value(formData, "reviewDue"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("safeguarding_alerts").insert({
    patient_id: parsed.data.patientId,
    alert_type: parsed.data.alertType,
    severity: parsed.data.severity,
    note: parsed.data.note,
    review_due: parsed.data.reviewDue ?? null,
    added_by: staffId,
  });
  if (error) return { error: error.code === "42501" ? NOT_YOURS : GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  revalidatePath("/clinic/safeguarding");
  return { saved: "Safeguarding alert added.", sentAt: Date.now() };
}

/** Doctors mark an alert resolved. It stays on the record. */
export async function resolveSafeguardingAlert(_state: RecordFormState, formData: FormData): Promise<RecordFormState> {
  await requireRoleAndStaffId(["doctor"]);
  const parsed = z
    .object({ patientId: z.uuid(), alertId: z.uuid() })
    .safeParse({ patientId: value(formData, "patientId"), alertId: value(formData, "alertId") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("safeguarding_alerts")
    .update({ status: "resolved" })
    .eq("id", parsed.data.alertId)
    .eq("patient_id", parsed.data.patientId)
    .select("id");
  if (error || !data?.length) return { error: NOT_YOURS };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  revalidatePath("/clinic/safeguarding");
  return { saved: "Marked resolved." };
}
