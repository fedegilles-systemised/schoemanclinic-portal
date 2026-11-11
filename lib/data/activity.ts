import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type AppRole = Database["public"]["Enums"]["app_role"];

export const ACTIVITY_PAGE = 50;

export type ActivityRow = {
  id: number;
  at: string;
  actorName: string;
  actorRole: AppRole | null;
  action: string;
  entity: string;
  patientName: string | null;
  patientRef: string | null;
};

/**
 * One page of the activity log, newest first, for an admin. The database refuses anyone else.
 * The log holds who did what and to which record, never a clinical value.
 */
export async function getActivity(before?: number): Promise<ActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activity_log", { _limit: ACTIVITY_PAGE, _before: before });
  if (error) throw new Error("Could not load the activity log.");
  return data.map((row) => ({
    id: row.id,
    at: row.created_at,
    actorName: row.actor_name ?? "The system",
    actorRole: row.actor_role,
    action: row.action,
    entity: row.entity,
    patientName: row.patient_name,
    patientRef: row.patient_ref,
  }));
}
