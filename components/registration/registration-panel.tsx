import Link from "next/link";

import { CheckIdentityButton } from "@/components/registration/identity-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import type { RegistrationDetail } from "@/lib/data/registration";
import { formatDate } from "@/lib/format";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="type-small text-content-muted">{label}</dt>
      <dd className="type-body whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

/**
 * The registration form a new patient completed, on their record. Everyone who can open the record reads the
 * answers. Only PAs and admins can open the photo ID and mark it as checked.
 */
export function RegistrationPanel({
  patientId,
  registration,
  required,
  canSeeIdentity,
  checkedBy,
}: {
  patientId: string;
  registration: RegistrationDetail | null;
  /** The patient was added after the form began, so it is expected. */
  required: boolean;
  canSeeIdentity: boolean;
  checkedBy: string | null;
}) {
  if (!registration && !required) return null;
  return (
    <section aria-labelledby="registration" className="mb-12 flex flex-col gap-4">
      <SectionHeader id="registration" title="Registration " accent="form" />
      {!registration ? (
        <EmptyState>The patient has not completed the registration form yet. They cannot use the portal until they do.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6 border border-surface-border bg-surface-raised p-5">
          <p className="type-small text-content-muted">
            Completed {formatDate(registration.submittedAt)}. A permanent copy of the form is in Submitted forms.
          </p>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {registration.title ? <Line label="Title">{registration.title}</Line> : null}
            {registration.address ? <Line label="Address">{registration.address}</Line> : null}
            <Line label="Occupation">{registration.occupation}</Line>
            <Line label="Next of kin">
              {registration.nextOfKin.name}, {registration.nextOfKin.relationship}. {registration.nextOfKin.phone}
            </Line>
            <Line label="GP">
              {registration.gp.name}
              {"\n"}
              {registration.gp.practice}
            </Line>
            <Line label="News and insights from the doctors">{registration.newsOptOut ? "The patient prefers not to receive them" : "The patient may receive them"}</Line>
            <Line label="WhatsApp about their care">{registration.whatsappConsent ? "Consent given" : "No consent given"}</Line>
          </dl>
          <dl className="grid gap-4">
            <Line label="Main reason for the visit">{registration.mainReason}</Line>
            <Line label="How long they have had it">{registration.concernDuration}</Line>
            <Line label="What they have already tried">{registration.alreadyTried}</Line>
            <Line label="Their health goals for the next 12 months">{registration.healthGoals}</Line>
          </dl>
          {canSeeIdentity ? (
            <div className="flex flex-col gap-3 border-t border-surface-border pt-4">
              <h3 className="type-eyebrow text-content-muted">Photo ID</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/clinic/patients/${patientId}/identity`} target="_blank" rel="noopener noreferrer" className="type-button-label text-content underline underline-offset-4">
                  Open the photo ID
                </Link>
                <span className="type-small text-content-muted">Opening it is written to the activity log.</span>
              </div>
              {registration.identityCheckedAt ? (
                <p className="type-body">
                  Checked on {formatDate(registration.identityCheckedAt)}
                  {checkedBy ? ` by ${checkedBy}` : ""}.
                </p>
              ) : (
                <CheckIdentityButton patientId={patientId} />
              )}
            </div>
          ) : (
            <p className="type-small text-content-muted">
              {registration.identityCheckedAt ? "The photo ID has been checked by the team." : "The photo ID is waiting to be checked by the reception team."} Only PAs and admins can open it.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
