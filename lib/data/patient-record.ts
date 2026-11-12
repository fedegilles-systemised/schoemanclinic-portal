import "server-only";

import { todayInLondon } from "@/lib/calendar/time";
import type { Database } from "@/lib/database.types";
import type { TreatmentOptions } from "@/lib/notes/options";
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
  authorId: string;
  authorName: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  options: TreatmentOptions;
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
      .select(
        "id, title, body, source, status, version, author_id, signed_at, created_at, updated_at, all_options_discussed, customised_options_discussed, nice_options_discussed, side_effects_discussed, options_offered",
      )
      .eq("patient_id", patientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_staff_directory"),
  ]);
  if (team.error || notes.error || directory.error) throw new Error("Could not load the patient's record.");

  const names = new Map(directory.data.map((person) => [person.staff_id, person.full_name]));

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
      authorId: n.author_id,
      authorName: names.get(n.author_id) ?? "A former team member",
      signedAt: n.signed_at,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      options: {
        allOptionsDiscussed: n.all_options_discussed,
        customisedOptionsDiscussed: n.customised_options_discussed,
        niceOptionsDiscussed: n.nice_options_discussed,
        sideEffectsDiscussed: n.side_effects_discussed,
        optionsOffered: n.options_offered,
      },
    })),
  };
}

/** The signed-in person's staff id, for "is this my draft". Null for anyone without one. */
export async function getMyStaffId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export type RecordingRow = { id: string; status: "uploading" | "transcribing" | "transcribed" | "failed"; createdAt: string; recordedBy: string };

/** Recent call recordings of one patient, newest first. */
export async function getRecordings(patientId: string): Promise<RecordingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_recordings")
    .select("id, status, created_at, recorded_by")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Could not load the recordings.");
  return data.map((r) => ({ id: r.id, status: r.status, createdAt: r.created_at, recordedBy: r.recorded_by }));
}

export type GuardianLink = { id: string; name: string; email: string; relationship: string; canAct: boolean };

/** The guardians who can currently see this patient's portal. For PAs and admins, who manage them. */
export async function getGuardians(patientId: string): Promise<GuardianLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_guardians")
    .select("id, relationship, can_act, guardian:profiles!patient_guardians_guardian_user_id_fkey(full_name, email)")
    .eq("patient_id", patientId)
    .eq("can_view", true);
  if (error) throw new Error("Could not load the patient's guardians.");
  return data.map((g) => ({
    id: g.id,
    name: g.guardian?.full_name ?? "Guardian",
    email: g.guardian?.email ?? "",
    relationship: g.relationship,
    canAct: g.can_act,
  }));
}

export type AllergyRow = { id: string; substance: string; reaction: string | null; severity: string | null; createdAt: string };
export type DiagnosisRow = {
  id: string;
  label: string;
  icd10Code: string | null;
  status: Database["public"]["Enums"]["diagnosis_status"];
  diagnosedOn: string | null;
  notes: string | null;
};
export type MedicationRow = {
  id: string;
  name: string;
  dose: string | null;
  instructions: string | null;
  kind: Database["public"]["Enums"]["med_kind"];
  status: Database["public"]["Enums"]["med_status"];
  startDate: string;
  supplyDays: number;
};
export type SafeguardingRow = {
  id: string;
  alertType: string;
  severity: Database["public"]["Enums"]["safeguarding_severity"];
  note: string;
  reviewDue: string | null;
  status: string;
  createdAt: string;
  addedByName: string;
};

/** Allergies, diagnoses and medicines on one patient's record, as row-level security allows. */
export async function getClinicalSummary(patientId: string): Promise<{ allergies: AllergyRow[]; diagnoses: DiagnosisRow[]; medications: MedicationRow[] }> {
  const supabase = await createClient();
  const [allergies, diagnoses, medications] = await Promise.all([
    supabase
      .from("patient_allergies")
      .select("id, substance, reaction, severity, created_at")
      .eq("patient_id", patientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("diagnoses")
      .select("id, label, icd10_code, status, diagnosed_on, notes")
      .eq("patient_id", patientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("medications")
      .select("id, name, dose, instructions, kind, status, start_date, supply_days")
      .eq("patient_id", patientId)
      .is("archived_at", null)
      .order("start_date", { ascending: false }),
  ]);
  if (allergies.error || diagnoses.error || medications.error) throw new Error("Could not load the patient's record.");
  return {
    allergies: allergies.data.map((a) => ({ id: a.id, substance: a.substance, reaction: a.reaction, severity: a.severity, createdAt: a.created_at })),
    diagnoses: diagnoses.data.map((d) => ({ id: d.id, label: d.label, icd10Code: d.icd10_code, status: d.status, diagnosedOn: d.diagnosed_on, notes: d.notes })),
    medications: medications.data.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      instructions: m.instructions,
      kind: m.kind,
      status: m.status,
      startDate: m.start_date,
      supplyDays: m.supply_days,
    })),
  };
}

/**
 * Safeguarding alerts: doctors only, by row-level security. Pass a patient for one record, or
 * nothing for every active alert on the doctor's own patients.
 */
export async function getSafeguardingAlerts(patientId?: string): Promise<(SafeguardingRow & { patientId: string; patientName: string })[]> {
  const supabase = await createClient();
  let query = supabase
    .from("safeguarding_alerts")
    .select("id, patient_id, alert_type, severity, note, review_due, status, created_at, added_by, patient:patient_profiles(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  query = patientId ? query.eq("patient_id", patientId) : query.eq("status", "active");
  const [alerts, directory] = await Promise.all([query, supabase.rpc("get_staff_directory")]);
  if (alerts.error || directory.error) throw new Error("Could not load the safeguarding alerts.");
  const names = new Map(directory.data.map((person) => [person.staff_id, person.full_name]));
  return alerts.data.map((a) => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : "",
    alertType: a.alert_type,
    severity: a.severity,
    note: a.note,
    reviewDue: a.review_due,
    status: a.status,
    createdAt: a.created_at,
    addedByName: a.added_by ? (names.get(a.added_by) ?? "A former team member") : "Imported",
  }));
}
