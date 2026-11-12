import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin, UserRound } from "lucide-react";
import { z } from "zod";

import { CancelAppointmentButton } from "@/components/booking/book-slot";
import { MoveAppointmentForm } from "@/components/diary/forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { addDays, dayHeading, isDay, londonInstant, londonParts, todayInLondon } from "@/lib/calendar/time";
import { getDiary, getDiaryPeople } from "@/lib/data/diary";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking · Clinic Hub" };

/** One booking from the diary: who, when and with whom, and, for staff who can open the record, move or cancel. */
export default async function DiaryEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { date } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  // The diary is read a day at a time; without a date (a link from a notice), the booking's own row says which day.
  let day = isDay(date) ? date : null;
  if (!day) {
    const supabase = await createClient();
    const row = await supabase.from("appointments").select("starts_at").eq("id", id).maybeSingle();
    day = row.data ? londonParts(row.data.starts_at).day : null;
  }
  if (!day) notFound();
  const [entries, { clinicians, locations }] = await Promise.all([getDiary(londonInstant(day, "00:00"), londonInstant(addDays(day, 1), "00:00")), getDiaryPeople()]);
  const entry = entries.find((e) => e.id === id);
  if (!entry) notFound();
  const clinician = clinicians.find((c) => c.staffId === entry.clinicianId);
  const place = locations.find((l) => l.id === entry.locationId);
  const time = londonParts(entry.startsAt).time ?? "";
  const ends = londonParts(entry.endsAt).time ?? "";
  // Today or later; the database refuses a move into the past.
  const future = day >= todayInLondon();

  return (
    <>
      <Link href={`/clinic/diary?view=day&date=${day}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Diary
      </Link>
      <PageHeader eyebrow={entry.type} title={`${entry.patientName} `} description={`${entry.clinicRef}${entry.status === "no_show" ? ". Did not attend." : entry.status === "completed" ? ". Completed." : "."}`} />

      {entry.newPatient ? (
        <div className="mb-6">
          <Alert variant="info">
            <AlertDescription>
              A new patient booked this online. Check their details on their record, add them to a care team and invite them to the portal before the appointment.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              {clinician?.name ?? "No clinician"}
            </p>
            <p className="type-body flex items-center gap-2">
              <MapPin className="size-4 text-content-muted" aria-hidden />
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

        {entry.canOpen && future && (entry.status === "booked" || entry.status === "confirmed") ? (
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
