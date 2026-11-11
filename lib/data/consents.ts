import "server-only";

import type { ConsentType } from "@/lib/consents/constants";
import { createClient } from "@/lib/supabase/server";

export type ConsentState = { granted: boolean; version: string; changedAt: string };

/** The current choice for each consent: the latest row of each kind. Missing means never asked. */
export async function getConsents(patientId: string): Promise<Partial<Record<ConsentType, ConsentState>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("consent_type, granted, version, changed_at")
    .eq("patient_id", patientId)
    .order("changed_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load the consents.");
  const current: Partial<Record<ConsentType, ConsentState>> = {};
  for (const row of data) {
    if (!current[row.consent_type]) current[row.consent_type] = { granted: row.granted, version: row.version, changedAt: row.changed_at };
  }
  return current;
}
