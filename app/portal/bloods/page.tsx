import type { Metadata } from "next";

import { OrdersTable } from "@/components/orders/parts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { listPatientOrders } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Lab orders · The Schoeman Clinic" };

/** The blood tests ordered for the patient chosen in the portal. */
export default async function PortalBloodsPage() {
  const patient = await getPortalPatientId();
  const orders = patient ? await listPatientOrders(patient.id) : [];
  return (
    <>
      <PageHeader eyebrow="Blood tests" title="Your " accent="blood tests" description="Pay for a test your clinician has ordered, see how to prepare, and find your barcode." />
      {orders.length === 0 ? (
        <EmptyState>Any bloods your doctor orders will appear here.</EmptyState>
      ) : (
        <OrdersTable rows={orders} base="/portal/bloods" showPatient={false} />
      )}
    </>
  );
}
