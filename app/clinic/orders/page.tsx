import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CancelOrderButton, SampleTakenButton } from "@/components/orders/forms";
import { OrdersTable } from "@/components/orders/parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { listClinicOrders } from "@/lib/data/orders";
import { isStripeConfigured } from "@/lib/env";
import { OPEN_STATUSES } from "@/lib/orders/constants";

export const metadata: Metadata = { title: "Lab orders · Clinic Hub" };

/** Blood test orders: those waiting for payment or a sample, and those finished. */
export default async function ClinicOrdersPage({ searchParams }: { searchParams: Promise<{ ordered?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa" || r === "admin")) redirect("/clinic");
  const { ordered } = await searchParams;
  const orders = await listClinicOrders();
  const canAct = user.roles.some((r) => r === "doctor" || r === "pa");
  const isAdmin = user.roles.includes("admin");
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  const finished = orders.filter((o) => !OPEN_STATUSES.includes(o.status));
  const done = finished.slice(0, 50);

  return (
    <>
      <PageHeader
        eyebrow="Blood tests"
        title="Lab "
        accent="orders"
        description="Order from a patient's record. The patient pays, then gets their barcode and how to prepare. Record the sample once it is taken; results arrive by the lab or by PDF import."
      >
        {isAdmin ? (
          <Link href="/clinic/panels" className="type-button-label text-content no-underline">
            Panels and fees
          </Link>
        ) : null}
      </PageHeader>

      {ordered ? (
        <div className="mb-6">
          <Alert variant={ordered === "told" ? "success" : "warning"}>
            <AlertDescription>
              {ordered === "told" ? "Order made, and the patient has been told." : "Order made. The patient could not be told by email or WhatsApp, so please let them know."}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {!isStripeConfigured() ? (
        <div className="mb-6">
          <Alert variant="warning">
            <AlertDescription>Online payment is not switched on, so patients cannot pay yet and no barcode is made.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <section aria-labelledby="open" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="open" title="In " accent="progress" />
        {open.length === 0 ? <EmptyState>No orders in progress.</EmptyState> : <OrdersTable rows={open} showPatient />}
        {canAct
          ? open
              .filter((o) => o.status === "sent_to_patient" || o.status === "paid")
              .map((o) => (
                <div key={o.id} className="type-small flex flex-wrap items-center gap-4 border-t border-surface-border pt-3">
                  <span className="text-content-muted">
                    {o.patientName} · {o.panelName}
                  </span>
                  {o.status === "paid" ? <SampleTakenButton orderId={o.id} /> : <CancelOrderButton orderId={o.id} />}
                </div>
              ))
          : null}
      </section>

      <section aria-labelledby="done" className="flex flex-col gap-4">
        <SectionHeader id="done" title="Recently " accent="finished" />
        {done.length === 0 ? <EmptyState>None yet.</EmptyState> : <OrdersTable rows={done} showPatient />}
        {finished.length > done.length ? <p className="type-small text-content-muted">Showing the 50 most recent. Older orders are kept on each patient&apos;s record.</p> : null}
      </section>
    </>
  );
}
