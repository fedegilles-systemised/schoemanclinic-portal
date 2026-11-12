"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
      <fieldset className="flex flex-col gap-3" aria-describedby="score-scale">
        <legend className="type-body mb-1 font-medium">{FEEDBACK_QUESTIONS.score}</legend>
        <p id="score-scale" className="type-small text-content-muted">
          0 means not at all likely and 10 means extremely likely.
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, score) => (
            <label key={score} className="type-body flex min-w-11 cursor-pointer flex-col items-center gap-1 border border-surface-border px-2 py-2 tabular-nums has-[:checked]:border-secondary-border has-[:checked]:bg-surface-selected has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary-border">
              <input type="radio" name="score" value={score} required className="size-4 accent-secondary" aria-label={`${score} out of 10`} />
              <span aria-hidden>{score}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wentWell" className="type-body font-medium">
          {FEEDBACK_QUESTIONS.wentWell} <span className="font-normal text-content-muted">(optional)</span>
        </label>
        <Textarea id="wentWell" name="wentWell" maxLength={2000} rows={4} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="couldImprove" className="type-body font-medium">
          {FEEDBACK_QUESTIONS.couldImprove} <span className="font-normal text-content-muted">(optional)</span>
        </label>
        <Textarea id="couldImprove" name="couldImprove" maxLength={2000} rows={4} />
      </div>

      <YesNo name="wantsContact" legend={FEEDBACK_QUESTIONS.wantsContact} />
      <YesNo name="mayQuote" legend={FEEDBACK_QUESTIONS.mayQuote} />

      <p className="type-small text-content-muted">
        Please do not use this form for anything urgent about your health. Call the clinic, or in an emergency call 999.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Send feedback
        </Button>
      </div>
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
        <label htmlFor="note" className="type-body font-medium">
          What was done, and the outcome
        </label>
        <Textarea id="note" name="note" required maxLength={2000} rows={4} />
      </div>
      <FormMessage state={state} />
      <div>
        <ConfirmButton loading={pending} confirmTitle="Record this follow-up?" confirmText="It becomes part of the clinic's permanent record and cannot be changed afterwards.">
          Record follow-up
        </ConfirmButton>
      </div>
    </form>
  );
}
