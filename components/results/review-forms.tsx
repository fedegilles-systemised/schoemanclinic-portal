"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { releaseReport, saveComments, type ResultsFormState } from "@/lib/results/actions";

const initial: ResultsFormState = {};

export function CommentsForm({
  reportId,
  fields,
}: {
  reportId: string;
  fields: { id: string; name: string; comment: string | null }[];
}) {
  const [state, action, pending] = useActionState(saveComments, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="reportId" value={reportId} />
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1.5">
          <label htmlFor={`comment_${field.id}`} className="type-eyebrow text-content-muted">
            Comment on {field.name}
          </label>
          <Textarea id={`comment_${field.id}`} name={`comment_${field.id}`} defaultValue={field.comment ?? ""} maxLength={1000} className="min-h-20" />
        </div>
      ))}
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="outline" loading={pending}>
          Save comments
        </Button>
      </div>
    </form>
  );
}

/**
 * Releasing signs the report off for the CQC audit trail: action (described) or no action. Who
 * ordered the tests is shown, so signing off another doctor's order is a deliberate choice.
 */
export function ReleaseForm({ reportId, orderedBy }: { reportId: string; orderedBy: { name: string; isYou: boolean } | null }) {
  const [state, action, pending] = useActionState(releaseReport, initial);
  const [outcome, setOutcome] = useState<"" | "action" | "no_action">("");
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="reportId" value={reportId} />
      <p className="type-small text-content-muted">
        {orderedBy
          ? orderedBy.isYou
            ? "You ordered these tests."
            : `Ordered by ${orderedBy.name}. Your sign-off will show that another doctor signed off.`
          : "There is no order for this report (results from an outside lab or the patient)."}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="type-eyebrow mb-1 text-content-muted">Sign-off</legend>
        {(
          [
            ["no_action", "No action needed"],
            ["action", "Action needed"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="type-body flex items-center gap-2">
            <input
              type="radio"
              name="outcome"
              value={value}
              checked={outcome === value}
              onChange={() => setOutcome(value)}
              className="size-4 accent-secondary"
              required
            />
            {label}
          </label>
        ))}
      </fieldset>
      {outcome === "action" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="release-action" className="type-eyebrow text-content-muted">
            The action (for the team, not shown to the patient)
          </label>
          <Textarea id="release-action" name="actionNote" maxLength={2000} required />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="release-comment" className="type-eyebrow text-content-muted">
          A note for the patient (optional)
        </label>
        <Textarea id="release-comment" name="comment" maxLength={2000} />
      </div>
      <p className="type-small text-content-muted">
        Signing off releases every result in this report to the patient and tells them. The sign-off is recorded for audit and cannot be changed.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Sign off and release
        </Button>
      </div>
    </form>
  );
}
