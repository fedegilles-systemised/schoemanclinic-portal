"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordFollowUp, submitFeedback, type FeedbackFormState } from "@/lib/feedback/actions";
import { FEEDBACK_QUESTIONS } from "@/lib/feedback/constants";

const initial: FeedbackFormState = {};

function YesNo({ name, legend }: { name: string; legend: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-body mb-1 font-medium">{legend}</legend>
      <div className="flex gap-6">
        {(["yes", "no"] as const).map((option) => (
          <label key={option} className="type-body flex items-center gap-2">
            <input type="radio" name={name} value={option} required className="size-4 accent-secondary" />
            {option === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The feedback survey: a 0 to 10 score, two optional comments and two yes or no questions. */
export function FeedbackForm({ feedbackId }: { feedbackId: string }) {
  const [state, action, pending] = useActionState(submitFeedback, initial);
  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="type-body mb-1 font-medium">{FEEDBACK_QUESTIONS.score}</legend>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, score) => (
            <label key={score} className="type-body flex min-w-11 cursor-pointer flex-col items-center gap-1 border border-surface-border px-2 py-2 has-[:checked]:border-secondary-border has-[:checked]:bg-surface-selected">
              <input type="radio" name="score" value={score} required className="size-4 accent-secondary" aria-label={`${score} out of 10`} />
              <span aria-hidden>{score}</span>
            </label>
          ))}
        </div>
        <p className="type-small flex justify-between text-content-muted">
          <span>0: not at all likely</span>
          <span>10: extremely likely</span>
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wentWell">{FEEDBACK_QUESTIONS.wentWell} (optional)</Label>
        <Textarea id="wentWell" name="wentWell" maxLength={2000} rows={4} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="couldImprove">{FEEDBACK_QUESTIONS.couldImprove} (optional)</Label>
        <Textarea id="couldImprove" name="couldImprove" maxLength={2000} rows={4} />
      </div>

      <YesNo name="wantsContact" legend={FEEDBACK_QUESTIONS.wantsContact} />
      <YesNo name="mayQuote" legend={FEEDBACK_QUESTIONS.mayQuote} />

      <p className="type-small text-content-muted">
        Please do not use this form for anything urgent about your health. Call the clinic, or in an emergency call 999.
      </p>
      <div>
        <Button type="submit" loading={pending}>
          Send feedback
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** How the clinic followed up amber or red feedback. Permanent once saved, so it asks first. */
export function FollowUpForm({ feedbackId }: { feedbackId: string }) {
  const [state, action, pending] = useActionState(recordFollowUp, initial);
  return (
    <form action={action} className="flex flex-col gap-4" key={state.sentAt ?? "follow-up"}>
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">What was done, and the outcome</Label>
        <Textarea id="note" name="note" required maxLength={2000} rows={4} />
      </div>
      <div>
        <ConfirmButton loading={pending} confirmTitle="Record this follow-up?" confirmText="It becomes part of the clinic's permanent record and cannot be changed afterwards.">
          Record follow-up
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
