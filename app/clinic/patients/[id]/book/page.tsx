import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { BookingPicker } from "@/components/booking/booking-picker";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { freeSlots } from "@/lib/booking/slots";
import { getBookingOptions } from "@/lib/data/appointments";
import { getPatientRecord } from "@/lib/data/patient-record";

export const metadata: Metadata = { title: "Book an appointment · The Schoeman Clinic" };

/** Staff book for a patient they can open, with any clinician. */
export default async function BookForPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; staff?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const record = await getPatientRecord(id);
  if (!record) notFound();
  const query = await searchParams;
  const options = await getBookingOptions(record.id, false);
  const type = options.types.find((t) => t.id === query.type);
  const clinician = options.clinicians.find((c) => c.staffId === query.staff);
  const days = type && clinician ? await freeSlots({ staffId: clinician.staffId, clinicianUserId: clinician.profileId, durationMin: type.durationMin }) : null;

  return (
    <>
      <Link href={`/clinic/patients/${record.id}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Back to {record.name}
      </Link>
      <PageHeader eyebrow={record.clinicRef} title="Book for " accent={record.name} description="Free times follow the clinician's hours, their bookings and their Google Calendar if connected." />
      <BookingPicker action={`/clinic/patients/${record.id}/book`} patientId={record.id} back="clinic" options={options} typeId={type?.id} staffId={clinician?.staffId} days={days} />
    </>
  );
}
