import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestsTable } from "@/components/prescriptions/parts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { listRepeatRequests } from "@/lib/data/prescriptions";
import { isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { REPEAT_FEE_PENCE } from "@/lib/prescriptions/constants";

export const metadata: Metadata = { title: "Prescriptions · Clinic Hub" };

/** Repeat requests waiting for the team, those not yet paid for, and those finished. */
export default async function ClinicPrescriptionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa" || r === "admin")) redirect("/clinic");
  const requests = await listRepeatRequests();
  const paysOnline = isStripeConfigured();

  // Without online payment, unpaid requests are work for the team too.
  const toDo = requests.filter((r) => r.stage === "requested" || r.stage === "approved" || (!paysOnline && r.stage === "unpaid"));
  const unpaid = paysOnline ? requests.filter((r) => r.stage === "unpaid") : [];
  const done = requests.filter((r) => r.stage === "sent_to_pharmacy" || r.stage === "declined" || r.stage === "withdrawn").slice(0, 50);
  const keepsList = user.roles.some((r) => r === "admin" || r === "doctor");

  return (
    <>
      <PageHeader
        eyebrow="Prescriptions"
        title="Repeat "
        accent="requests"
        description={
          paysOnline
            ? "Paid requests wait here for a decision. Prescribe in SignatureRx, then mark the request sent to the pharmacy."
            : `Online payment is not switched on, so check the ${formatMoney(REPEAT_FEE_PENCE)} fee has been paid before you go ahead. Prescribe in SignatureRx, then mark the request sent to the pharmacy.`
        }
      >
        {keepsList ? (
          <Link href="/clinic/prescriptions/medicines" className="type-button-label text-content no-underline">
            The clinic&apos;s medicine list
          </Link>
        ) : null}
      </PageHeader>

      <section aria-labelledby="to-do" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="to-do" title="To " accent="do" />
        {toDo.length === 0 ? <EmptyState>Nothing waiting.</EmptyState> : <RequestsTable rows={toDo} base="/clinic/prescriptions" showPatient />}
      </section>

      {paysOnline ? (
        <section aria-labelledby="unpaid" className="mb-12 flex flex-col gap-4">
          <SectionHeader id="unpaid" title="Awaiting " accent="payment" />
          {unpaid.length === 0 ? <EmptyState>None.</EmptyState> : <RequestsTable rows={unpaid} base="/clinic/prescriptions" showPatient />}
        </section>
      ) : null}

      <section aria-labelledby="done" className="flex flex-col gap-4">
        <SectionHeader id="done" title="Recently " accent="finished" />
        {done.length === 0 ? <EmptyState>None yet.</EmptyState> : <RequestsTable rows={done} base="/clinic/prescriptions" showPatient />}
      </section>
    </>
  );
}
