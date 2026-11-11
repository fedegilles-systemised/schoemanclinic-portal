import type { Metadata } from "next";
import { CircleCheck, CircleMinus, CircleX } from "lucide-react";

import { ConsentChoice } from "@/components/consents/consent-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { CONSENT_TYPES, CONSENTS, PRIVACY_CONTACT, PRIVACY_POLICY_URL } from "@/lib/consents/constants";
import { getConsents } from "@/lib/data/consents";
import { getPortalPatientId } from "@/lib/data/education";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Privacy and consent · The Schoeman Clinic" };

/** The patient's consent choices, each change kept with the wording's version. */
export default async function PrivacyPage() {
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const consents = await getConsents(patient.id);

  return (
    <>
      <PageHeader
        eyebrow="Privacy and consent"
        title="Privacy and "
        accent="consent"
        description="How the clinic uses your information, and the choices you have made."
      />
      <p className="type-body mb-8 max-w-prose">
        Read the clinic&apos;s{" "}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
          privacy policy
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        . For a copy of your information, or any question about privacy, email{" "}
        <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
      </p>
      <div className="flex flex-col gap-6">
        {CONSENT_TYPES.map((type) => {
          const current = consents[type];
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{CONSENTS[type].title}</CardTitle>
                  {current ? (
                    current.granted ? (
                      <StatusPill tone="success" icon={CircleCheck} label="Given" />
                    ) : (
                      <StatusPill tone="neutral" icon={CircleX} label="Withdrawn" />
                    )
                  ) : (
                    <StatusPill tone="neutral" icon={CircleMinus} label="Not recorded" />
                  )}
                </div>
                <CardDescription>{CONSENTS[type].description}</CardDescription>
              </CardHeader>
              <CardContent>
                {current ? <p className="type-small text-content-muted">Last changed {formatDate(current.changedAt)}.</p> : null}
                {patient.canAct ? <ConsentChoice patientId={patient.id} type={type} granted={current ? current.granted : null} /> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
