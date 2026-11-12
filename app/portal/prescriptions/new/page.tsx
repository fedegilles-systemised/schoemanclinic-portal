import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { RepeatRequestForm } from "@/components/prescriptions/request-form";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalPatientId } from "@/lib/data/education";
import { getCatalogue, getCurrentMedicines, hasUpcomingAppointment } from "@/lib/data/prescriptions";
import { isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { REPEAT_FEE_PENCE } from "@/lib/prescriptions/constants";

export const metadata: Metadata = { title: "Request a repeat · The Schoeman Clinic" };

export default async function NewRepeatRequestPage() {
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  if (!patient.canAct) redirect("/portal/prescriptions");
  const [medicines, list, upcoming] = await Promise.all([getCurrentMedicines(patient.id), getCatalogue(), hasUpcomingAppointment(patient.id)]);

  return (
    <>
      <Link href="/portal/prescriptions" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Prescriptions
      </Link>
      <PageHeader
        eyebrow="Prescriptions"
        title="Request a "
        accent="repeat"
        description={`Dr Gina Schoeman reviews every request. There is an administration fee of ${formatMoney(REPEAT_FEE_PENCE)}.`}
      />
      <Card>
        <CardContent>
          <RepeatRequestForm
            patientId={patient.id}
            medicines={medicines.map((m) => ({ id: m.id, name: m.dose ? `${m.name} (${m.dose})` : m.name }))}
            list={list.map((m) => ({ id: m.id, name: m.name, weightLoss: m.weightLoss }))}
            hasUpcomingAppointment={upcoming}
            feeLabel={formatMoney(REPEAT_FEE_PENCE)}
            paysOnline={isStripeConfigured()}
          />
        </CardContent>
      </Card>
    </>
  );
}
