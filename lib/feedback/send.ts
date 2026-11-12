import "server-only";

import { feedbackRequestEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { notifyPatient } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily: asks for feedback the day after an appointment is completed, and reminds once three days
 * later (Dr Schoeman's CQC email, point 1). The database chooses who is asked, at most once every
 * 90 days, and writes each survey before it is sent, so a failed message is not sent twice. The
 * message names nothing about the visit.
 */
export async function sendFeedbackSurveys(): Promise<{ sent: number; reminded: number }> {
  const admin = createAdminClient();
  const [queued, due] = await Promise.all([admin.rpc("queue_feedback"), admin.rpc("due_feedback_reminders")]);
  if (queued.error || due.error) throw new Error("Could not prepare the feedback surveys.");

  const siteUrl = getSiteUrl();
  const send = async (row: { feedback_id: string; patient_id: string }, reminder: boolean) => {
    const patient = await admin.from("patient_profiles").select("first_name").eq("id", row.patient_id).maybeSingle();
    const link = `/portal/feedback/${row.feedback_id}`;
    const hello = patient.data?.first_name ? `Hello ${patient.data.first_name}` : "Hello";
    await notifyPatient(row.patient_id, {
      topic: "messages",
      notice: { title: reminder ? "A reminder: how was your appointment?" : "How was your appointment?", body: "Tell us in less than a minute.", link },
      email: feedbackRequestEmail({ siteUrl, firstName: patient.data?.first_name, surveyUrl: `${siteUrl}${link}`, reminder }),
      whatsapp: reminder
        ? `${hello}, a reminder that we would value your feedback on your recent appointment. It takes less than a minute in your portal.`
        : `${hello}, thank you for your recent appointment. We would value your feedback: it takes less than a minute in your portal.`,
    });
  };

  for (const row of queued.data ?? []) await send(row, false);
  for (const row of due.data ?? []) await send(row, true);
  return { sent: queued.data?.length ?? 0, reminded: due.data?.length ?? 0 };
}
