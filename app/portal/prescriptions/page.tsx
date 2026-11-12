import type { Metadata } from "next";
import Link from "next/link";
import { Pill } from "lucide-react";

import { RequestsTable } from "@/components/prescriptions/parts";
import { AlertBar } from "@/components/ui/alert-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { getCurrentMedicines, listRepeatRequests } from "@/lib/data/prescriptions";
import { formatDate } from "@/lib/format";
import { RUN_OUT_WARNING_DAYS } from "@/lib/prescriptions/constants";

export const metadata: Metadata = { title: "Prescriptions · The Schoeman Clinic" };

/** Current medicines with when they run out, repeat requests, and the way to ask for one. */
export default async function PrescriptionsPage() {
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const [medicines, requests] = await Promise.all([getCurrentMedicines(patient.id), listRepeatRequests({ patientId: patient.id })]);
  const runningLow = medicines.filter((m) => m.kind === "prescription" && m.daysLeft <= RUN_OUT_WARNING_DAYS).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <>
      <PageHeader
        eyebrow="Prescriptions"
        title="Your "
        accent="prescriptions"
        description="Your current medicines, when each supply runs out, and your repeat requests."
      >
        {patient.canAct ? (
          <Button asChild>
            <Link href="/portal/prescriptions/new">Request a repeat</Link>
          </Button>
        ) : null}
      </PageHeader>

      {runningLow[0] ? (
        <AlertBar tone="warning" icon={Pill} lead={runningLow[0].daysLeft > 0 ? `${runningLow[0].name} runs out on ${formatDate(runningLow[0].runOut)}.` : `${runningLow[0].name} has run out.`} className="mb-8">
          Please request a repeat at least three weeks ahead, so there is time to prepare and send it.
        </AlertBar>
      ) : null}

      <section aria-labelledby="current" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="current" title="Current " accent="medicines" />
        {medicines.length === 0 ? (
          <EmptyState>Your doctor has not added any medicines to your record yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border border border-surface-border bg-surface-raised">
            {medicines.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="type-body">
                  {m.name}
                  <span className="type-small text-content-muted">
                    {m.dose ? ` · ${m.dose}` : ""}
                    {m.instructions ? ` · ${m.instructions}` : ""}
                  </span>
                </span>
                <span className={m.daysLeft <= RUN_OUT_WARNING_DAYS ? "type-small font-medium text-status-warning" : "type-small text-content-muted"}>
                  {m.daysLeft <= 0 ? "Supply has run out" : m.daysLeft <= RUN_OUT_WARNING_DAYS ? `Running low: runs out ${formatDate(m.runOut)}` : `Runs out ${formatDate(m.runOut)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="requests" className="flex flex-col gap-4">
        <SectionHeader id="requests" title="Repeat " accent="requests" />
        {requests.length === 0 ? <EmptyState>No repeat requests yet.</EmptyState> : <RequestsTable rows={requests} base="/portal/prescriptions" showPatient={false} />}
      </section>
    </>
  );
}
