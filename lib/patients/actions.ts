"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { todayInLondon } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export type CareTeamFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not do that. Please try again.";
const CARE_TEAM_EDITORS = ["pa", "admin", "doctor"] as const;

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (CARE_TEAM_EDITORS as readonly string[]).includes(role))) {
    redirect("/clinic");
  }
  return user;
}

const addSchema = z.object({
  patientId: z.uuid(),
  staffId: z.uuid("Choose a team member."),
  relationship: z.enum(["primary_doctor", "doctor", "nurse", "pa", "health_coach"], "Choose their role for this patient."),
});

/** Adds someone to a patient's care team. Row-level security checks who may, for which patient. */
export async function addToCareTeam(_state: CareTeamFormState, formData: FormData): Promise<CareTeamFormState> {
  await requireEditor();
  const parsed = addSchema.safeParse({
    patientId: formData.get("patientId"),
    staffId: formData.get("staffId"),
    relationship: formData.get("relationship"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("care_team").insert({
    patient_id: parsed.data.patientId,
    staff_id: parsed.data.staffId,
    relationship: parsed.data.relationship,
    since: todayInLondon(),
  });
  if (error) {
    // One current primary doctor per patient, enforced by a unique index.
    if (error.code === "23505") return { error: "This patient already has a primary doctor. Remove them first, or add this doctor as a doctor." };
    return { error: GENERIC_FAILURE };
  }
  revalidatePath("/clinic/patients");
  return { saved: "Added to the care team." };
}

/**
 * Takes someone off a care team today. The row is kept with today as the leaving day, so the
 * history of who looked after the patient stays; access stops at once.
 */
export async function removeFromCareTeam(_state: CareTeamFormState, formData: FormData): Promise<CareTeamFormState> {
  await requireEditor();
  const id = z.uuid().safeParse(formData.get("careTeamId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_team")
    .update({ until: todayInLondon() })
    .eq("id", id.data)
    .is("until", null)
    .select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/patients");
  return { saved: "Removed from the care team." };
}
