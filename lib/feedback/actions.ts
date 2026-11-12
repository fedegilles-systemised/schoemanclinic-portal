"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { sendEmail } from "@/lib/email/send";
import { feedbackAlertEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { FEEDBACK_ALERT_TO_DEFAULT } from "@/lib/feedback/constants";
import { createClient } from "@/lib/supabase/server";

export type FeedbackFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const TOO_MANY = "Too many attempts at once. Please wait a while and try again.";

function friendly(message: string | undefined, fallback = GENERIC_FAILURE): string {
  const known = [
    "This survey has already been answered.",
    "This survey has closed.",
    "Choose a score from 0 to 10.",
    "Answer every question.",
    "Use 2,000 characters or fewer for each answer.",
    "The follow-up has already been recorded.",
    "Describe the follow-up, in up to 2,000 characters.",
    "This survey has not been answered.",
    "Only comments the patient agreed may be quoted can be checked.",
  ];
  return message && known.includes(message) ? message : fallback;
}

const yesNo = z.enum(["yes", "no"], { error: "Answer every question." });
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/**
 * A patient, or a guardian who can act, answers a feedback survey. Amber and red answers alert the
 * team in Clinic Hub (written by the database) and the clinic inbox, with no name and nothing the
 * patient wrote. Then the patient sees the thank-you page, with the Google review link whatever
 * their answer.
 */
export async function submitFeedback(_state: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended) redirect("/portal");
  const parsed = z
    .object({
      feedbackId: z.uuid(),
      score: z.coerce.number({ error: "Choose a score from 0 to 10." }).int().min(0, "Choose a score from 0 to 10.").max(10, "Choose a score from 0 to 10."),
      wentWell: z.string().trim().max(2000, "Use 2,000 characters or fewer for each answer."),
      couldImprove: z.string().trim().max(2000, "Use 2,000 characters or fewer for each answer."),
      wantsContact: yesNo,
      mayQuote: yesNo,
    })
    .safeParse({
      feedbackId: formData.get("feedbackId"),
      score: formData.get("score") ?? undefined,
      wentWell: text(formData.get("wentWell")),
      couldImprove: text(formData.get("couldImprove")),
      wantsContact: formData.get("wantsContact") ?? undefined,
      mayQuote: formData.get("mayQuote") ?? undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("feedback", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { data: rating, error } = await supabase.rpc("submit_feedback", {
    _feedback: parsed.data.feedbackId,
    _score: parsed.data.score,
    _went_well: parsed.data.wentWell,
    _could_improve: parsed.data.couldImprove,
    _wants_contact: parsed.data.wantsContact === "yes",
    _may_quote: parsed.data.mayQuote === "yes",
  });
  if (error) return { error: friendly(error.message, "We could not save your answers. Please try again.") };

  if (rating === "amber" || rating === "red") {
    try {
      const siteUrl = getSiteUrl();
      await sendEmail({
        to: process.env.FEEDBACK_ALERT_TO || FEEDBACK_ALERT_TO_DEFAULT,
        ...feedbackAlertEmail({ siteUrl, feedbackUrl: `${siteUrl}/clinic/feedback/${parsed.data.feedbackId}`, urgent: rating === "red" }),
      });
    } catch {
      console.error("Feedback alert not emailed.");
    }
  }
  revalidatePath("/portal", "layout");
  revalidatePath("/clinic/feedback", "layout");
  redirect(`/portal/feedback/${parsed.data.feedbackId}`);
}

/** An admin, PA or doctor records how feedback was followed up. Permanent once saved. */
export async function recordFollowUp(_state: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "admin" || r === "pa" || r === "doctor")) redirect("/clinic");
  const parsed = z
    .object({
      feedbackId: z.uuid(),
      note: z.string().trim().min(1, "Describe the follow-up, in up to 2,000 characters.").max(2000, "Describe the follow-up, in up to 2,000 characters."),
    })
    .safeParse({ feedbackId: formData.get("feedbackId"), note: text(formData.get("note")) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("feedback", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_feedback_follow_up", { _feedback: parsed.data.feedbackId, _note: parsed.data.note });
  if (error) return { error: friendly(error.message, "You cannot follow up this feedback.") };
  revalidatePath("/clinic/feedback", "layout");
  return { saved: "Follow-up recorded.", sentAt: Date.now() };
}

/**
 * An admin, PA or doctor marks a patient's comments as checked for use as CQC evidence (no name
 * and no health detail in them), or takes the check back. Only checked comments are downloaded.
 */
export async function checkQuote(_state: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "admin" || r === "pa" || r === "doctor")) redirect("/clinic");
  const parsed = z
    .object({ feedbackId: z.uuid(), checked: z.enum(["yes", "no"]) })
    .safeParse({ feedbackId: formData.get("feedbackId"), checked: formData.get("checked") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  if (!(await allowAuthAttempt("feedback", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.rpc("check_feedback_quote", { _feedback: parsed.data.feedbackId, _checked: parsed.data.checked === "yes" });
  if (error) return { error: friendly(error.message, "You cannot check this feedback.") };
  revalidatePath("/clinic/feedback", "layout");
  return {
    saved: parsed.data.checked === "yes" ? "Checked. These comments are now in the evidence download." : "Check taken back. These comments are no longer in the evidence download.",
    sentAt: Date.now(),
  };
}
