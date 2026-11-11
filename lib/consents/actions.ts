"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { CONSENT_TYPES, CONSENT_VERSION } from "@/lib/consents/constants";
import { createClient } from "@/lib/supabase/server";

export type ConsentFormState = { error?: string; saved?: string };

/**
 * Records a consent choice. Nothing is overwritten: each change is a new row with the wording's
 * version, and the latest row is the current choice. The database checks the person can act.
 */
export async function setConsent(_state: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  const parsed = z
    .object({ patientId: z.uuid(), type: z.enum(CONSENT_TYPES), granted: z.enum(["yes", "no"]) })
    .safeParse({ patientId: formData.get("patientId"), type: formData.get("type"), granted: formData.get("granted") });
  if (!parsed.success) return { error: "We could not save that. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("consents").insert({
    patient_id: parsed.data.patientId,
    consent_type: parsed.data.type,
    version: CONSENT_VERSION,
    granted: parsed.data.granted === "yes",
  });
  if (error) return { error: "We could not save that. Please try again." };
  revalidatePath("/portal/privacy");
  return { saved: parsed.data.granted === "yes" ? "Consent given." : "Consent withdrawn. The clinic team can see this on your record." };
}
