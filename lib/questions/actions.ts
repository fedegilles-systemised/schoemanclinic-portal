"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { sendEmail } from "@/lib/email/send";
import { questionAlertEmail, questionReplyEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { notifyPatient } from "@/lib/notify/patient";
import { QUESTIONS_ALERT_TO_DEFAULT } from "@/lib/questions/constants";
import { createClient } from "@/lib/supabase/server";

export type QuestionFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not send that. Please try again.";
const TOO_MANY = "Too many messages at once. Please wait a while and try again.";

function friendly(message: string | undefined): string {
  if (message?.includes("closed")) return "This conversation is closed. Please ask a new question.";
  if (message?.includes("4,000")) return "Write a reply of up to 4,000 characters.";
  return GENERIC_FAILURE;
}

/** A patient, or a guardian who can act, asks the clinic. The database checks who may ask for whom. */
export async function askQuestion(_state: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  const parsed = z
    .object({
      patientId: z.uuid(),
      subject: z.string().trim().min(1, "Add a subject.").max(120, "Use 120 characters or fewer for the subject."),
      body: z.string().trim().min(1, "Write your question.").max(4000, "Use 4,000 characters or fewer."),
      urgency: z.enum(["routine", "important"]),
    })
    .safeParse({
      patientId: formData.get("patientId"),
      subject: formData.get("subject"),
      body: formData.get("body"),
      urgency: formData.get("urgency") ?? "routine",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("question", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      patient_id: parsed.data.patientId,
      asked_by: user.id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      urgency: parsed.data.urgency,
    })
    .select("id")
    .single();
  if (error) return { error: GENERIC_FAILURE };

  // The clinic's inbox hears that a question is waiting, and nothing else about it.
  try {
    const siteUrl = getSiteUrl();
    await sendEmail({
      to: process.env.QUESTIONS_ALERT_TO || QUESTIONS_ALERT_TO_DEFAULT,
      ...questionAlertEmail({ siteUrl, questionsUrl: `${siteUrl}/clinic/questions` }),
    });
  } catch {
    console.error("Question alert not sent.");
  }

  revalidatePath("/portal/questions");
  revalidatePath("/clinic/questions");
  redirect(`/portal/questions/${data.id}?sent=1`);
}

/** A reply from either side. The database decides which side the person is on and moves the status. */
export async function replyToQuestion(_state: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended) redirect("/login");
  const parsed = z
    .object({
      questionId: z.uuid(),
      body: z.string().trim().min(1, "Write a reply.").max(4000, "Use 4,000 characters or fewer."),
    })
    .safeParse({ questionId: formData.get("questionId"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("question", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  // The database decides which side the person is on; the form does not get a say.
  const { data: fromClinic, error } = await supabase.rpc("reply_to_question", { _question: parsed.data.questionId, _body: parsed.data.body });
  if (error) return { error: friendly(error.message) };

  let saved = "Reply sent.";
  if (fromClinic) {
    const question = await supabase
      .from("questions")
      .select("patient_id, patient:patient_profiles(first_name)")
      .eq("id", parsed.data.questionId)
      .maybeSingle();
    if (question.data) {
      const siteUrl = getSiteUrl();
      const link = `/portal/questions/${parsed.data.questionId}`;
      const delivery = await notifyPatient(question.data.patient_id, {
        topic: "messages",
        notice: { title: "The clinic has replied", body: "There is a reply to your question.", link },
        email: questionReplyEmail({ siteUrl, firstName: question.data.patient?.first_name, portalUrl: `${siteUrl}${link}` }),
        whatsapp: `Hello ${question.data.patient?.first_name ?? ""}, the clinic has replied to your question. Please sign in to your portal to read it.`,
      });
      if (delivery.email === "suspended") saved = "Reply sent. The patient's account is not active, so they were not told.";
      else if (delivery.email !== "sent" && delivery.whatsapp !== "sent") saved = "Reply sent to the portal. The patient could not be told by email or WhatsApp.";
      else saved = "Reply sent, and the patient has been told.";
    }
  }

  revalidatePath("/portal/questions", "layout");
  revalidatePath("/clinic/questions", "layout");
  return { saved, sentAt: Date.now() };
}

/** Staff close a conversation that needs nothing more. */
export async function closeQuestion(_state: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/login");
  const id = z.uuid().safeParse(formData.get("questionId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_question", { _question: id.data });
  if (error) return { error: "You cannot close this question." };
  revalidatePath("/clinic/questions", "layout");
  revalidatePath("/portal/questions", "layout");
  return { saved: "Question closed." };
}
