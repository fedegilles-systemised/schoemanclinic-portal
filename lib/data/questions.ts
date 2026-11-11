import "server-only";

import type { QuestionStatus, QuestionUrgency } from "@/lib/questions/constants";
import { createClient } from "@/lib/supabase/server";

export type QuestionSummary = {
  id: string;
  subject: string;
  status: QuestionStatus;
  urgency: QuestionUrgency;
  createdAt: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
};

export type QuestionMessage = { id: string; body: string; fromClinic: boolean; authorName: string; createdAt: string };
export type QuestionThread = QuestionSummary & { messages: QuestionMessage[] };

/**
 * Questions the signed-in person may read: their own (or a ward's) in the portal, or every patient
 * they can open in the clinic. Row-level security decides; the patient filter keeps a team member
 * who is also a patient to their own questions in the portal.
 */
export async function listQuestions({ patientId, open }: { patientId?: string; open?: boolean } = {}): Promise<QuestionSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("questions")
    .select("id, subject, status, urgency, created_at, patient_id, patient:patient_profiles(first_name, last_name, clinic_ref)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (patientId) query = query.eq("patient_id", patientId);
  if (open) query = query.neq("status", "closed");
  const { data, error } = await query;
  if (error) throw new Error("Could not load the questions.");
  return data.map((q) => ({
    id: q.id,
    subject: q.subject,
    status: q.status,
    urgency: q.urgency,
    createdAt: q.created_at,
    patientId: q.patient_id,
    patientName: q.patient ? `${q.patient.first_name} ${q.patient.last_name}` : "",
    clinicRef: q.patient?.clinic_ref ?? "",
  }));
}

/** One conversation: the question, then every reply in order. Null if not found or not theirs. */
export async function getQuestionThread(questionId: string): Promise<QuestionThread | null> {
  const supabase = await createClient();
  const question = await supabase
    .from("questions")
    .select("id, subject, body, status, urgency, created_at, asked_by, patient_id, patient:patient_profiles(first_name, last_name, clinic_ref)")
    .eq("id", questionId)
    .maybeSingle();
  if (question.error) throw new Error("Could not load the question.");
  if (!question.data) return null;
  const [replies, directory] = await Promise.all([
    supabase
      .from("question_replies")
      .select("id, body, from_clinic, author_id, created_at")
      .eq("question_id", questionId)
      .order("created_at"),
    supabase.rpc("get_staff_directory"),
  ]);
  if (replies.error || directory.error) throw new Error("Could not load the question.");
  const staffNames = new Map(directory.data.map((person) => [person.profile_id, person.full_name]));
  const q = question.data;
  const patientName = q.patient ? `${q.patient.first_name} ${q.patient.last_name}` : "";
  return {
    id: q.id,
    subject: q.subject,
    status: q.status,
    urgency: q.urgency,
    createdAt: q.created_at,
    patientId: q.patient_id,
    patientName,
    clinicRef: q.patient?.clinic_ref ?? "",
    messages: [
      { id: `${q.id}-question`, body: q.body, fromClinic: false, authorName: patientName, createdAt: q.created_at },
      ...replies.data.map((r) => ({
        id: r.id,
        body: r.body,
        fromClinic: r.from_clinic,
        authorName: r.from_clinic ? (staffNames.get(r.author_id) ?? "The clinic team") : patientName,
        createdAt: r.created_at,
      })),
    ],
  };
}
