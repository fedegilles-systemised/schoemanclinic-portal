import type { Metadata } from "next";

import { BookingPicker } from "@/components/booking/booking-picker";
import { AppointmentsTable } from "@/components/booking/appointments-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { freeSlots } from "@/lib/booking/slots";
import { getBookingOptions, getUpcomingAppointments } from "@/lib/data/appointments";
import { getPortalPatientId } from "@/lib/data/education";

export const metadata: Metadata = { title: "Appointments · The Schoeman Clinic" };

/** The patient's appointments, and booking with the clinicians who look after them. No cancel or move: the team does that. */
export default async function PortalAppointmentsPage({ searchParams }: { searchParams: Promise<{ type?: string; staff?: string; booked?: string }> }) {
  const params = await searchParams;
  const patient = await getPortalPatientId();
  if (!patient) return <EmptyState>Your record is not ready yet.</EmptyState>;
  const [appointments, options] = await Promise.all([
    getUpcomingAppointments(patient.id),
    patient.canAct ? getBookingOptions(patient.id, true) : Promise.resolve(null),
  ]);
  const type = options?.types.find((t) => t.id === params.type);
  const clinician = options?.clinicians.find((c) => c.staffId === params.staff);
  const days = type && clinician ? await freeSlots({ staffId: clinician.staffId, clinicianUserId: clinician.profileId, durationMin: type.durationMin }) : null;

  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Your "
        accent="appointments"
        description="To change or cancel an appointment, please contact the clinic at least 48 hours before."
      />
      {params.booked ? (
        <div className="mb-6">
          <Alert variant="success">
            <AlertDescription>Your appointment is booked. We have sent you a confirmation.</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <section aria-labelledby="upcoming" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="upcoming" title="Coming " accent="up" />
        {appointments.length === 0 ? <EmptyState>No appointments booked.</EmptyState> : <AppointmentsTable rows={appointments} />}
      </section>
      {options ? (
        <section aria-labelledby="book" className="flex flex-col gap-4">
          <SectionHeader id="book" title="Book an " accent="appointment" />
          <BookingPicker action="/portal/appointments" patientId={patient.id} back="portal" options={options} typeId={type?.id} staffId={clinician?.staffId} days={days} />
        </section>
      ) : null}
    </>
  );
}
