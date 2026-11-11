import "server-only";

import type { Database } from "@/lib/database.types";
import { todayInLondon } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

type CareRelationship = Database["public"]["Enums"]["care_relationship"];
type NoteSource = Database["public"]["Enums"]["note_source"];

export type RecordNote = {
  id: string;
  title: string;
  body: string;
  source: NoteSource;
  status: "draft" | "signed";
  version: number;
  supersedesId: string | null;
  authorId: string;
  authorName: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** A signed note that a later version corrects. */
  correctedBy: string | null;
};

export type PatientRecord = {
  id: string;
  name: string;
  clinicRef: string;
  dateOfBirth: string;
  careTeam: { name: string; relationship: CareRelationship }[];
  notes: RecordNote[];
};

/**
 * One patient's record for the clinic, through the signed-in person's own session: row-level
 * security returns nothing for a patient they may not open. Null means not found or not theirs.
 */
export async function getPatientRecord(patientId: string): Promise<PatientRecord | null> {
  const supabase = await createClient();
  const today = todayInLondon();
  const patient = await supabase
    .from("patient_profiles")
    .select("id, first_name, last_name, clinic_ref, date_of_birth")
    .eq("id", patientId)
    .is("archived_at", null)
    .maybeSingle();
  if (patient.error) throw new Error("Could not load the patient.");
  if (!patient.data) return null;

  const [team, notes, directory] = await Promise.all([
    supabase
      .from("care_team")
      .select("staff_id, relationship")
      .eq("patient_id", patientId)
      .lte("since", today)
      .or(`until.is.null,until.gt.${today}`),
    supabase
      .from("clinical_notes")
      .select("id, title, body, source, status, version, supersedes_id, author_id, signed_at, created_at, updated_at")
      .eq("patient_id", patientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_staff_directory"),
  ]);
  if (team.error || notes.error || directory.error) throw new Error("Could not load the patient's record.");

  const names = new Map(directory.data.map((person) => [person.staff_id, person.full_name]));
  const correctedBy = new Map(notes.data.filter((n) => n.supersedes_id).map((n) => [n.supersedes_id as string, n.id]));

  return {
    id: patient.data.id,
    name: `${patient.data.first_name} ${patient.data.last_name}`,
    clinicRef: patient.data.clinic_ref,
    dateOfBirth: patient.data.date_of_birth,
    careTeam: team.data.map((row) => ({ name: names.get(row.staff_id) ?? "A former team member", relationship: row.relationship })),
    notes: notes.data.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      source: n.source,
      status: n.status,
      version: n.version,
      supersedesId: n.supersedes_id,
      authorId: n.author_id,
      authorName: names.get(n.author_id) ?? "A former team member",
      signedAt: n.signed_at,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      correctedBy: correctedBy.get(n.id) ?? null,
    })),
  };
}

/** The signed-in person's staff id, for "is this my draft". Null for anyone without one. */
export async function getMyStaffId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}
