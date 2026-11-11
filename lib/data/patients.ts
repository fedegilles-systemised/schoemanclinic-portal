import "server-only";

import type { Database } from "@/lib/database.types";
import { todayInLondon } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

type CareRelationship = Database["public"]["Enums"]["care_relationship"];
type StaffRole = Database["public"]["Enums"]["staff_role"];

export type CareTeamMember = {
  id: string;
  staffId: string;
  name: string;
  relationship: CareRelationship;
  since: string;
};

export type PatientRow = {
  id: string;
  name: string;
  clinicRef: string;
  dateOfBirth: string;
  careTeam: CareTeamMember[];
};

export type StaffOption = { id: string; name: string; role: StaffRole };

/**
 * The patients this person may see, with each one's current care team. Row-level security decides
 * the list: every patient for PAs and admins, only care-team patients for doctors, nurses and
 * health coaches.
 */
export async function getPatientList(): Promise<{ patients: PatientRow[]; staff: StaffOption[] }> {
  const supabase = await createClient();
  const today = todayInLondon();
  const [patients, team, directory] = await Promise.all([
    supabase
      .from("patient_profiles")
      .select("id, first_name, last_name, clinic_ref, date_of_birth")
      .is("archived_at", null)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("care_team")
      .select("id, patient_id, staff_id, relationship, since, until")
      .lte("since", today)
      .or(`until.is.null,until.gt.${today}`),
    supabase.rpc("get_staff_directory"),
  ]);
  if (patients.error || team.error || directory.error) throw new Error("Could not load the patient list.");

  const names = new Map(directory.data.map((person) => [person.staff_id, person.full_name]));
  const byPatient = new Map<string, CareTeamMember[]>();
  for (const row of team.data) {
    const list = byPatient.get(row.patient_id) ?? [];
    list.push({ id: row.id, staffId: row.staff_id, name: names.get(row.staff_id) ?? "A former team member", relationship: row.relationship, since: row.since });
    byPatient.set(row.patient_id, list);
  }

  return {
    patients: patients.data.map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      clinicRef: p.clinic_ref,
      dateOfBirth: p.date_of_birth,
      careTeam: (byPatient.get(p.id) ?? []).sort((a, b) => a.relationship.localeCompare(b.relationship)),
    })),
    staff: directory.data
      .filter((person) => person.clinical_role !== "admin")
      .map((person) => ({ id: person.staff_id, name: person.full_name, role: person.clinical_role }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
