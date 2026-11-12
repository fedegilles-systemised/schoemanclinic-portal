import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type FormKind = Database["public"]["Enums"]["form_kind"];
export type FormAnswer = { question: string; answer: string };
export type FormSubmission = {
  id: string;
  kind: FormKind;
  title: string;
  answers: FormAnswer[];
  submittedBy: string;
  submittedAt: string;
};

function answersOf(value: unknown): FormAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) =>
    line && typeof line === "object" && typeof (line as FormAnswer).question === "string" && typeof (line as FormAnswer).answer === "string"
      ? [{ question: (line as FormAnswer).question, answer: (line as FormAnswer).answer }]
      : [],
  );
}

/**
 * Every form submitted for a patient, newest first: the questions as asked and the answers given.
 * Row-level security decides what the signed-in person reads (feedback only for admins, PAs and the
 * patient's doctors).
 */
export async function listForms(patientId: string, { limit = 200 }: { limit?: number } = {}): Promise<FormSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id, kind, title, answers, submitted_by, submitted_at")
    .eq("patient_id", patientId)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load the forms.");
  return data.map((f) => ({ id: f.id, kind: f.kind, title: f.title, answers: answersOf(f.answers), submittedBy: f.submitted_by, submittedAt: f.submitted_at }));
}

/**
 * For the team: who submitted each form, in words. The patient, a team member by name, or a
 * guardian (a guardian's name is not shown to the team here).
 */
export async function submitterLabels(patientId: string, forms: FormSubmission[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (forms.length === 0) return labels;
  const supabase = await createClient();
  const [patient, directory] = await Promise.all([
    supabase.from("patient_profiles").select("user_id").eq("id", patientId).maybeSingle(),
    supabase.rpc("get_staff_directory"),
  ]);
  const staff = new Map((directory.data ?? []).map((p) => [p.profile_id, p.full_name]));
  for (const form of forms) {
    if (labels.has(form.submittedBy)) continue;
    if (patient.data?.user_id && form.submittedBy === patient.data.user_id) labels.set(form.submittedBy, "by the patient");
    else if (staff.has(form.submittedBy)) labels.set(form.submittedBy, `by ${staff.get(form.submittedBy)} for the patient`);
    else labels.set(form.submittedBy, "by a guardian");
  }
  return labels;
}
