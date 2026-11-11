import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { PORTAL_PATIENT_COOKIE } from "@/lib/portal/constants";
import { createClient } from "@/lib/supabase/server";

export type PortalRecord = Database["public"]["Functions"]["get_my_patient_record"]["Returns"][number];

/** Every patient the signed-in person can see in the portal: their own record first, then those they look after. */
export const getPortalPatients = cache(async (): Promise<PortalRecord[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_patient_record");
  if (error) throw new Error("Could not load your record.");
  return [...data].sort((a, b) => Number(b.is_self) - Number(a.is_self) || a.first_name.localeCompare(b.first_name));
});

/**
 * The patient the portal is showing. The choice is kept in a cookie, but only ever picks from the
 * records the database returns for this person, so a changed cookie can show nothing new.
 */
export const getPortalPatient = cache(async (): Promise<PortalRecord | null> => {
  const patients = await getPortalPatients();
  const chosen = (await cookies()).get(PORTAL_PATIENT_COOKIE)?.value;
  return patients.find((p) => p.id === chosen) ?? patients[0] ?? null;
});
