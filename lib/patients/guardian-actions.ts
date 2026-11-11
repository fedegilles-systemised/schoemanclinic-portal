"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type GuardianFormState = { error?: string; saved?: string };

/**
 * Removes a guardian from a patient's account: their view and act rights are switched off at once.
 * Nothing is deleted, and the audit log records who did it. PAs and admins only; the database
 * checks it as well.
 */
export async function removeGuardian(_state: GuardianFormState, formData: FormData): Promise<GuardianFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => role === "pa" || role === "admin")) redirect("/clinic");
  const parsed = z
    .object({ linkId: z.uuid(), patientId: z.uuid() })
    .safeParse({ linkId: formData.get("linkId"), patientId: formData.get("patientId") });
  if (!parsed.success) return { error: "We could not do that. Please try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_guardians")
    .update({ can_view: false, can_act: false })
    .eq("id", parsed.data.linkId)
    .eq("patient_id", parsed.data.patientId)
    .select("id");
  if (error || !data?.length) return { error: "We could not remove this guardian. Please try again." };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Guardian removed. They no longer see this patient's account." };
}
