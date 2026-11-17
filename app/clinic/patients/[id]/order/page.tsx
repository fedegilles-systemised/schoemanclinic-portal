import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { OrderForm } from "@/components/orders/forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getRouteFees, listPanels, listUpcomingAppointments } from "@/lib/data/orders";
import { getPatientRecord } from "@/lib/data/patient-record";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order bloods · The Schoeman Clinic" };

/** A doctor or PA orders a panel for a patient they can open. */
export default async function OrderBloodsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa")) redirect("/clinic");
  const record = await getPatientRecord(id);
  if (!record) notFound();

  const supabase = await createClient();
  const [sex, panels, fees, appointments] = await Promise.all([
    supabase.from("patient_profiles").select("sex").eq("id", record.id).maybeSingle(),
    listPanels(),
    getRouteFees(),
    listUpcomingAppointments(record.id),
  ]);
  const patientSex = sex.data?.sex === "F" || sex.data?.sex === "M" ? sex.data.sex : null;
  // Only panels that can be ordered, and for this patient. The database checks again.
  const available = panels.filter((p) => p.active && (p.sexRestriction === null || p.sexRestriction === patientSex));

  return (
    <>
      <Link href={`/clinic/patients/${record.id}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {record.name}
      </Link>
      <PageHeader eyebrow={record.clinicRef} title="Order bloods for " accent={record.name} />
      {!patientSex ? (
        <Alert variant="warning">
          <AlertDescription>
            This patient has no sex at birth on their record. Ask a PA to record it before ordering: it decides which panels apply, and it is never guessed.
          </AlertDescription>
        </Alert>
      ) : available.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>No panel can be ordered yet. An admin adds panels under Lab orders, then Panels and fees.</AlertDescription>
        </Alert>
      ) : (
        <OrderForm patientId={record.id} panels={available} fees={fees} appointments={appointments} />
      )}
    </>
  );
}
