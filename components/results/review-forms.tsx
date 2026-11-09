"use client";

import { useActionState } from "react";

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

export function ReleaseForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(releaseReport, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="reportId" value={reportId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="release-comment" className="type-eyebrow text-content-muted">
          A note for the patient (optional)
        </label>
        <Textarea id="release-comment" name="comment" maxLength={2000} />
      </div>
      <p className="type-small text-content-muted">Releasing makes every result in this report visible to the patient, and tells them.</p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Release to the patient
        </Button>
      </div>
    </form>
  );
}
