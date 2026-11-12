import "server-only";

import { isRating, type Rating } from "@/lib/feedback/constants";
import { createClient } from "@/lib/supabase/server";

export type FeedbackRow = {
  id: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
  sentAt: string;
  answeredAt: string | null;
  rating: Rating | null;
  score: number | null;
  wentWell: string | null;
  couldImprove: string | null;
  wantsContact: boolean | null;
  mayQuote: boolean | null;
  followUpDue: string | null;
  followUp: { note: string; byStaffId: string; at: string } | null;
};

const COLUMNS =
  "id, patient_id, sent_at, answered_at, rating, score, went_well, could_improve, wants_contact, may_quote, follow_up_due, patient:patient_profiles!patient_feedback_patient_id_fkey(first_name, last_name, clinic_ref), follow_up:feedback_follow_ups(note, followed_up_by, followed_up_at)";

type Row = {
  id: string;
  patient_id: string;
  sent_at: string;
  answered_at: string | null;
  rating: string | null;
  score: number | null;
  went_well: string | null;
  could_improve: string | null;
  wants_contact: boolean | null;
  may_quote: boolean | null;
  follow_up_due: string | null;
  patient: { first_name: string; last_name: string; clinic_ref: string } | null;
  follow_up: { note: string; followed_up_by: string; followed_up_at: string } | { note: string; followed_up_by: string; followed_up_at: string }[] | null;
};

function rowOf(r: Row): FeedbackRow {
  const followUp = Array.isArray(r.follow_up) ? (r.follow_up[0] ?? null) : r.follow_up;
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "",
    clinicRef: r.patient?.clinic_ref ?? "",
    sentAt: r.sent_at,
    answeredAt: r.answered_at,
    rating: isRating(r.rating) ? r.rating : null,
    score: r.score,
    wentWell: r.went_well,
    couldImprove: r.could_improve,
    wantsContact: r.wants_contact,
    mayQuote: r.may_quote,
    followUpDue: r.follow_up_due,
    followUp: followUp ? { note: followUp.note, byStaffId: followUp.followed_up_by, at: followUp.followed_up_at } : null,
  };
}

/**
 * Answered feedback the signed-in person may read: admins and PAs see every patient's, doctors
 * their care team's (row-level security). Newest first.
 */
export async function listAnsweredFeedback({ limit = 500 }: { limit?: number } = {}): Promise<FeedbackRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_feedback")
    .select(COLUMNS)
    .not("answered_at", "is", null)
    .order("answered_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load the feedback.");
  return (data as unknown as Row[]).map(rowOf);
}

/** One survey with its answer and follow-up. Null if not found or not readable. */
export async function getFeedback(id: string): Promise<FeedbackRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_feedback").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the feedback.");
  return data ? rowOf(data as unknown as Row) : null;
}

export type Survey = { id: string; patientId: string; answeredAt: string | null; expiresAt: string };

/** A survey as the patient sees it: whether it is still open. */
export async function getSurvey(id: string): Promise<Survey | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_feedback").select("id, patient_id, answered_at, expires_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the survey.");
  return data ? { id: data.id, patientId: data.patient_id, answeredAt: data.answered_at, expiresAt: data.expires_at } : null;
}

/** The patient's newest survey still waiting for an answer, for the portal home screen. */
export async function getOpenSurvey(patientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_feedback")
    .select("id")
    .eq("patient_id", patientId)
    .is("answered_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return data[0]?.id ?? null;
}
