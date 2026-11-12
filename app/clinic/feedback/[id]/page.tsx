import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { FollowUpForm } from "@/components/feedback/forms";
import { RatingPill } from "@/components/feedback/parts";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getFeedback } from "@/lib/data/feedback";
import { FEEDBACK_QUESTIONS } from "@/lib/feedback/constants";
import { formatDate, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feedback · Clinic Hub" };

const yes = (v: boolean | null) => (v === null ? "No answer" : v ? "Yes" : "No");

export default async function ClinicFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "admin" || r === "pa" || r === "doctor")) redirect("/clinic");
  const feedback = await getFeedback(id);
  if (!feedback) notFound();

  let followedUpBy = "";
  if (feedback.followUp) {
    const supabase = await createClient();
    const directory = await supabase.rpc("get_staff_directory");
    followedUpBy = (directory.data ?? []).find((p) => p.staff_id === feedback.followUp?.byStaffId)?.full_name ?? "a team member";
  }
  const needsFollowUp = (feedback.rating === "amber" || feedback.rating === "red") && !feedback.followUp;

  return (
    <>
      <Link href="/clinic/feedback" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All feedback
      </Link>
      <PageHeader
        eyebrow="Feedback"
        title={`${feedback.patientName} `}
        description={`${feedback.clinicRef}. Sent ${formatDate(feedback.sentAt)}${feedback.answeredAt ? `, answered ${formatDate(feedback.answeredAt)}` : ", not answered yet"}.`}
      >
        {feedback.rating ? <RatingPill rating={feedback.rating} /> : null}
      </PageHeader>
      <Link href={`/clinic/patients/${feedback.patientId}#forms`} className="type-button-label mb-6 inline-block text-content no-underline">
        Open their record
      </Link>

      {feedback.answeredAt ? (
        <Card className="mb-6">
          <CardContent>
            <dl className="type-body grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <dt className="text-content-muted">{FEEDBACK_QUESTIONS.score}</dt>
              <dd>{feedback.score} out of 10</dd>
              <dt className="text-content-muted">{FEEDBACK_QUESTIONS.wentWell}</dt>
              <dd className="whitespace-pre-wrap">{feedback.wentWell ?? "No answer"}</dd>
              <dt className="text-content-muted">{FEEDBACK_QUESTIONS.couldImprove}</dt>
              <dd className="whitespace-pre-wrap">{feedback.couldImprove ?? "No answer"}</dd>
              <dt className="text-content-muted">{FEEDBACK_QUESTIONS.wantsContact}</dt>
              <dd>{yes(feedback.wantsContact)}</dd>
              <dt className="text-content-muted">{FEEDBACK_QUESTIONS.mayQuote}</dt>
              <dd>{yes(feedback.mayQuote)}</dd>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {feedback.followUp ? (
        <Card>
          <CardTitle>Follow-up</CardTitle>
          <p className="type-body whitespace-pre-wrap">{feedback.followUp.note}</p>
          <p className="type-small text-content-muted">
            Recorded by {followedUpBy} on {formatDate(feedback.followUp.at)}, {formatTime(feedback.followUp.at)}.
          </p>
        </Card>
      ) : needsFollowUp ? (
        <Card>
          <CardTitle>Record the follow-up</CardTitle>
          <p className="type-small text-content-muted">
            Due by {feedback.followUpDue ? formatDate(feedback.followUpDue) : "soon"}. Contact the patient, then record what was done and the outcome.
          </p>
          <FollowUpForm feedbackId={feedback.id} />
        </Card>
      ) : null}
    </>
  );
}
