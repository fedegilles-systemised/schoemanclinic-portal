import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, UserRound } from "lucide-react";
import { z } from "zod";

import { CancelAppointmentButton, NoShowButton, UndoNoShowButton } from "@/components/booking/book-slot";
import { MoveAppointmentForm } from "@/components/diary/forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId } from "@/lib/data/patient-record";
import { addDays, dayHeading, hasPassed, isDay, londonInstant, londonParts, todayInLondon } from "@/lib/calendar/time";
import { getDiary, getDiaryPeople, getPossibleDuplicates } from "@/lib/data/diary";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking · Clinic Hub" };

/** One booking from the diary: who, when and with whom, and, for staff who can open the record, move or cancel. */
export default async function DiaryEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; noshow?: string }> }) {
  const { id } = await params;
  const { date, noshow } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  // The diary is read a day at a time; without a date (a link from a notice), the booking's own row says which day.
  const supabase = await createClient();
  // Read through row-level security: present for staff who can open the record, so a booking that
  // has just been moved or cancelled is still found.
  const own = await supabase.from("appointments").select("starts_at, status").eq("id", id).maybeSingle();
  let day = own.data ? londonParts(own.data.starts_at).day : isDay(date) ? date : null;
  if (!day) notFound();
  if (own.data?.status === "cancelled") {
    return (
      <>
        <Link href={`/clinic/diary?view=day&date=${day}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
          <ArrowLeft className="size-4" aria-hidden />
          Diary
        </Link>
        <PageHeader eyebrow="Booking" title="This booking is " accent="cancelled" description="It no longer shows in the diary. The clinician's calendar is updated where it is connected." />
      </>
    );
  }
  const [entries, { clinicians, locations }] = await Promise.all([getDiary(londonInstant(day, "00:00"), londonInstant(addDays(day, 1), "00:00")), getDiaryPeople()]);
  const entry = entries.find((e) => e.id === id);
  if (!entry) notFound();
  day = londonParts(entry.startsAt).day;
  const clinician = clinicians.find((c) => c.staffId === entry.clinicianId);
  const place = locations.find((l) => l.id === entry.locationId);
  const time = londonParts(entry.startsAt).time ?? "";
  const ends = londonParts(entry.endsAt).time ?? "";
  // Today or later; the database refuses a move into the past.
  const future = day >= todayInLondon();
  // A visit that has ended and was never attended can be marked as a no-show by a PA, a doctor or an admin.
  const myStaffId = await getMyStaffId(user.id);
  const isPaOrAdmin = user.roles.some((r) => r === "pa" || r === "admin");
  const mayMark = isPaOrAdmin || (user.roles.includes("doctor") && myStaffId !== null && entry.clinicianId === myStaffId);
  const canMarkNoShow = entry.canOpen && (entry.status === "booked" || entry.status === "confirmed") && hasPassed(entry.endsAt) && mayMark;
  const canUndoNoShow = entry.canOpen && entry.status === "no_show" && isPaOrAdmin;
  // For a new online record, an admin or a PA is shown any record that may be the same person.
  const duplicates = entry.newPatient && user.roles.some((r) => r === "admin" || r === "pa") ? await getPossibleDuplicates(entry.patientId) : [];

  return (
    <>
      <Link href={`/clinic/diary?view=day&date=${day}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Diary
      </Link>
      <PageHeader eyebrow={entry.type} title={`${entry.patientName} `} description={`${entry.clinicRef}${entry.status === "no_show" ? ". Did not attend." : entry.status === "completed" ? ". Completed." : "."}`} />

      {noshow === "1" ? (
        <div className="mb-6">
          <Alert variant="info">
            <AlertDescription>Marked as did not attend.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {entry.newPatient ? (
        <div className="mb-6">
          <Alert variant="info">
            <AlertDescription>
              A new patient booked this online. Before the appointment, a PA or admin checks their details on their record and invites them to the portal.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="mb-6">
          <Alert variant="warning">
            <AlertDescription>
              <p>This new record may be someone already on the clinic&apos;s books. Open each one and compare before you invite them to the portal. Nothing has been merged.</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {duplicates.map((d) => (
                  <li key={d.patientId}>
                    <Link href={`/clinic/patients/${d.patientId}`} className="text-content">
                      {d.clinicRef}
                    </Link>
                    : {d.reason.toLowerCase()}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 shell:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="type-body flex items-center gap-2">
              <CalendarDays className="size-4 text-content-muted" aria-hidden />
              {dayHeading(day)}
            </p>
            <p className="type-body flex items-center gap-2 tabular-nums">
              <Clock className="size-4 text-content-muted" aria-hidden />
              {time} to {ends} ({entry.durationMin} minutes)
            </p>
            <p className="type-body flex items-center gap-2">
              <UserRound className="size-4 text-content-muted" aria-hidden />
              <span className="sr-only">Clinician: </span>
              {clinician?.name ?? "No clinician"}
            </p>
            <p className="type-body flex items-center gap-2">
              <MapPin className="size-4 text-content-muted" aria-hidden />
              <span className="sr-only">Location: </span>
              {place?.name ?? "Not set"}
            </p>
            {entry.canOpen ? (
              <Link href={`/clinic/patients/${entry.patientId}`} className="type-button-label mt-2 text-content no-underline">
                Open their record
              </Link>
            ) : (
              <p className="type-small text-content-muted">Only their care team, PAs and admins can open this patient&apos;s record.</p>
            )}
          </CardContent>
        </Card>

        {canUndoNoShow ? (
          <Card>
            <CardHeader>
              <CardTitle>Marked as did not attend</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="type-body">If this was a mistake, a PA or admin can put it right.</p>
              <UndoNoShowButton appointmentId={entry.id} patientId={entry.patientId} label={`${entry.type} on ${dayHeading(day)} at ${time}`} />
            </CardContent>
          </Card>
        ) : null}

        {canMarkNoShow ? (
          <Card>
            <CardHeader>
              <CardTitle>Did the patient attend?</CardTitle>
            </CardHeader>
            <CardContent>
              <NoShowButton appointmentId={entry.id} patientId={entry.patientId} label={`${entry.type} on ${dayHeading(day)} at ${time}`} />
            </CardContent>
          </Card>
        ) : null}

        {entry.canOpen && entry.source === "clinic_hub" && future && (entry.status === "booked" || entry.status === "confirmed") ? (
          <Card>
            <CardHeader>
              <CardTitle>Change this booking</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <MoveAppointmentForm appointmentId={entry.id} staffId={entry.clinicianId} day={day} time={time} clinicians={clinicians.map((c) => ({ staffId: c.staffId, name: c.name }))} />
              <div className="border-t border-surface-border pt-4">
                <CancelAppointmentButton appointmentId={entry.id} patientId={entry.patientId} label={`${entry.type} on ${dayHeading(day)} at ${time}`} />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
