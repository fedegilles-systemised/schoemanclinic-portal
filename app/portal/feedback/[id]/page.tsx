import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FeedbackForm } from "@/components/feedback/forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSurvey } from "@/lib/data/feedback";
import { getGoogleReviewUrl } from "@/lib/env";
import { getPortalPatients } from "@/lib/portal/patient";

export const metadata: Metadata = { title: "Your feedback · The Schoeman Clinic" };

/**
 * A feedback survey in the portal, and the thank-you once answered. The Google review link is
 * offered only after positive feedback (a score of 9 or 10): the clinic's decision of 12 November
 * 2026, taken knowing that Google's review policy and the CMA's guidance discourage asking only
 * satisfied patients. Everyone else is followed up by the team, so is told to expect contact.
 */
export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [survey, patients] = await Promise.all([getSurvey(id), getPortalPatients()]);
  // Only a survey for the person themself or someone they look after; never one read as staff.
  const patient = survey ? patients.find((p) => p.id === survey.patientId) : undefined;
  if (!survey || !patient) notFound();
  const forSomeoneElse = patients.length > 1;

  if (survey.answeredAt) {
    const reviewUrl = survey.rating === "green" ? getGoogleReviewUrl() : null;
    // Amber and red answers are followed up by the team, so those patients are told to expect contact.
    const inTouch = survey.rating !== "green";
    return (
      <>
        <PageHeader
          eyebrow="Your feedback"
          title="Thank "
          accent="you"
          description={
            inTouch
              ? "Your answers have reached the clinic, and they are kept with your record. Someone from the clinic will be in touch soon."
              : "Your answers have reached the clinic, and they are kept with your record."
          }
        />
        {reviewUrl ? (
          <Card>
            <CardContent className="flex flex-col gap-4">
              <p className="type-body">If you have a moment, a review on Google helps other people find the clinic.</p>
              <div>
                <Button variant="secondary" asChild>
                  <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
                    Leave a Google review<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <Link href="/portal" className="type-button-label mt-6 inline-block text-content no-underline">
          Back to your home
        </Link>
      </>
    );
  }

  if (new Date(survey.expiresAt) <= new Date()) {
    return (
      <>
        <PageHeader eyebrow="Your feedback" title="This survey has " accent="closed" />
        <p className="type-body">
          Thank you for thinking of us. If there is anything you would like to tell the clinic, use{" "}
          <Link href="/portal/questions" className="text-content">
            Ask the clinic
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Your feedback"
        title="How was the "
        accent="appointment"
        description={`It takes less than a minute, and every answer is read by the clinic.${forSomeoneElse ? ` This survey is about ${patient.first_name}'s appointment.` : ""}`}
      />
      {patient.can_act ? (
        <Card>
          <CardContent>
            <FeedbackForm feedbackId={survey.id} />
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info">
          <AlertDescription>Only {patient.first_name} or a guardian who can act for them can answer this survey.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
