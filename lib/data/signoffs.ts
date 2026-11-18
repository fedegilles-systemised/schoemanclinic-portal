import "server-only";

import { isDay } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export const SIGNOFF_PAGE = 200;

export type SignoffRow = {
  reportId: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
  outcome: "action" | "no_action";
  signedByName: string;
  orderedByName: string | null;
  byOtherDoctor: boolean;
  signedAt: string;
};

/**
 * Results sign-offs, newest first, for the clinic's CQC evidence: who signed which report, when, and whether the
 * doctor who signed also ordered the tests. Read through the person's own session, so row-level security decides.
 * Dates are London days, from and to inclusive.
 */
export async function listSignoffs({ from, to }: { from?: string; to?: string }): Promise<{ rows: SignoffRow[]; more: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("lab_report_signoffs")
    .select("report_id, patient_id, outcome, signed_by, ordered_by, signed_at, patient:patient_profiles!inner(first_name, last_name, clinic_ref)")
    .order("signed_at", { ascending: false })
    .limit(SIGNOFF_PAGE + 1);
  if (isDay(from)) query = query.gte("signed_at", `${from}T00:00:00+00:00`);
  if (isDay(to)) query = query.lt("signed_at", `${new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T00:00:00+00:00`);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the sign-offs.");

  const directory = await supabase.rpc("get_staff_directory");
  const staffName = new Map((directory.data ?? []).map((p) => [p.staff_id, p.full_name]));
  const rows = data.slice(0, SIGNOFF_PAGE).map(
    (r): SignoffRow => ({
      reportId: r.report_id,
      patientId: r.patient_id,
      patientName: `${r.patient.first_name} ${r.patient.last_name}`,
      clinicRef: r.patient.clinic_ref,
      outcome: r.outcome === "action" ? "action" : "no_action",
      signedByName: staffName.get(r.signed_by) ?? "A former team member",
      orderedByName: r.ordered_by ? (staffName.get(r.ordered_by) ?? "A former team member") : null,
      byOtherDoctor: r.ordered_by !== null && r.ordered_by !== r.signed_by,
      signedAt: r.signed_at,
    }),
  );
  return { rows, more: data.length > SIGNOFF_PAGE };
}
