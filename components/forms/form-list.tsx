import type { FormSubmission } from "@/lib/data/forms";
import { formatDate, formatTime } from "@/lib/format";

/**
 * Submitted forms, newest first, each opening to the questions as asked and the answers given.
 * Read only: a submitted form is never changed.
 */
export function FormList({ forms, submitterName }: { forms: FormSubmission[]; submitterName?: (form: FormSubmission) => string | null }) {
  return (
    <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
      {forms.map((form) => {
        const by = submitterName?.(form);
        return (
          <li key={form.id}>
            <details className="group">
              <summary className="type-body flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{form.title}</span>
                <span className="type-small text-content-muted">
                  {formatDate(form.submittedAt)}, {formatTime(form.submittedAt)}
                  {by ? ` · ${by}` : ""}
                </span>
              </summary>
              <dl className="type-body grid gap-x-6 gap-y-2 border-t border-surface-border px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                {form.answers.map((line, index) => (
                  <div key={index} className="contents">
                    <dt className="text-content-muted">{line.question}</dt>
                    <dd className="whitespace-pre-wrap">{line.answer}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
