"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { isDay, todayInLondon } from "@/lib/calendar/time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptWearableToken, tokenBinding } from "@/lib/wearables/crypto";
import { getWearableProvider } from "@/lib/wearables/providers";
import { WEARABLE_METRIC_KEYS, WEARABLE_METRICS } from "@/lib/wearables/metrics";

export type WearableFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not save that. Please try again.";

async function requirePatientView() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  return user;
}

/** A reading typed in from a wearable. The database checks the person may act for this patient. */
export async function addReading(_state: WearableFormState, formData: FormData): Promise<WearableFormState> {
  const user = await requirePatientView();
  const parsed = z
    .object({
      patientId: z.uuid(),
      metric: z.enum(WEARABLE_METRIC_KEYS, "Choose what you are recording."),
      value: z.string().trim().transform((v) => v.replace(",", ".")).pipe(z.string().regex(/^-?\d{1,7}(\.\d{1,3})?$/, "Enter a number, like 62 or 7.5.")),
      measuredOn: z.string().refine((v) => isDay(v) && v <= todayInLondon() && v >= "2000-01-01", "Choose the date of the reading."),
      device: z.string().trim().max(80, "Use 80 characters or fewer for the device.").optional(),
    })
    .safeParse({
      patientId: formData.get("patientId"),
      metric: formData.get("metric"),
      value: formData.get("value"),
      measuredOn: formData.get("measuredOn"),
      device: formData.get("device") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const { min, max, label, unit } = WEARABLE_METRICS[parsed.data.metric];
  const value = Number(parsed.data.value);
  if (value < min || value > max) return { error: `${label} should be between ${min} and ${max} ${unit}.` };

  const supabase = await createClient();
  const { error } = await supabase.from("wearable_readings").insert({
    patient_id: parsed.data.patientId,
    metric: parsed.data.metric,
    value,
    measured_on: parsed.data.measuredOn,
    device: parsed.data.device || null,
    entered_by: user.id,
  });
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath("/portal/wearables");
  return { saved: "Reading saved." };
}

export async function archiveReading(_state: WearableFormState, formData: FormData): Promise<WearableFormState> {
  await requirePatientView();
  const id = z.uuid().safeParse(formData.get("readingId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wearable_readings")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Only the person who entered a reading can remove it." };
  revalidatePath("/portal/wearables");
  return { saved: "Reading removed." };
}

/**
 * Unlinks a wearable. The database checks the person can act for the patient. Where the provider lets us,
 * we also ask it to end the link first, so the access does not outlive the disconnect. The readings stay.
 */
export async function disconnectWearable(_state: WearableFormState, formData: FormData): Promise<WearableFormState> {
  await requirePatientView();
  const parsed = z.object({ patientId: z.uuid(), provider: z.enum(["oura", "whoop"]) }).safeParse({
    patientId: formData.get("patientId"),
    provider: formData.get("provider"),
  });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  // The person's own session must be able to see the link, which row-level security allows only for their patient.
  const found = await supabase.from("wearable_connections").select("id").eq("patient_id", parsed.data.patientId).eq("provider", parsed.data.provider).maybeSingle();
  if (found.error || !found.data) return { error: "That wearable is not connected." };

  // The token is read first, because the link is gone once the database has removed it. The database
  // checks who may act before anything else happens; only then is the provider asked to end its side.
  const provider = getWearableProvider(parsed.data.provider);
  let token: string | null = null;
  if (provider?.revoke) {
    try {
      const tokens = await createAdminClient().from("wearable_connections").select("access_token_encrypted").eq("id", found.data.id).maybeSingle();
      if (tokens.data) token = decryptWearableToken(tokens.data.access_token_encrypted, tokenBinding(parsed.data.patientId, parsed.data.provider));
    } catch {
      token = null;
    }
  }
  const { error } = await supabase.rpc("disconnect_wearable", { _patient: parsed.data.patientId, _provider: parsed.data.provider });
  if (error) return { error: error.code === "42501" ? "Only you, or a guardian who can act for you, can disconnect a wearable." : GENERIC_FAILURE };
  if (token && provider?.revoke) {
    try {
      await provider.revoke(token);
    } catch {
      // Best effort: the link is removed on our side either way.
    }
  }
  revalidatePath("/portal/wearables");
  return { saved: "Disconnected. Readings already saved stay on your record." };
}
