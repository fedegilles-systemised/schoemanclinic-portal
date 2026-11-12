"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { moveAppointment, searchPatients, type DiaryFormState, type PatientSearchState } from "@/lib/diary/actions";
import { formatDate } from "@/lib/format";

const initial: DiaryFormState = {};

/** Moves a booking to another day, time or clinician. Asks first, because the patient is told. */
export function MoveAppointmentForm({
  appointmentId,
  staffId,
  day,
  time,
  clinicians,
}: {
  appointmentId: string;
  staffId: string | null;
  day: string;
  time: string;
  clinicians: { staffId: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(moveAppointment, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="move-staff">Clinician</Label>
          <Select id="move-staff" name="staffId" defaultValue={staffId ?? ""} required>
            {clinicians.map((c) => (
              <option key={c.staffId} value={c.staffId}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="move-day">Date</Label>
          <Input id="move-day" name="day" type="date" defaultValue={day} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="move-time">Time</Label>
          <Input id="move-time" name="time" type="time" step={900} defaultValue={time} required />
        </div>
      </div>
      <FormMessage state={state} />
      <div>
        <ConfirmButton variant="outline" size="sm" loading={pending} confirmTitle="Move this appointment?" confirmText="We message the patient with the new time where their settings allow, and update the clinicians' connected calendars.">
          Move appointment
        </ConfirmButton>
      </div>
    </form>
  );
}

/** Finds a patient for a new booking. Results link to the booking screen for that patient. */
export function PatientSearch() {
  const [state, action, pending] = useActionState(searchPatients, {} as PatientSearchState);
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Patient name or clinic reference</Label>
          <Input id="q" name="q" defaultValue={state.query ?? ""} maxLength={80} required autoComplete="off" />
        </div>
        <Button type="submit" variant="outline" loading={pending}>
          Find
        </Button>
      </form>
      {state.error ? <FormMessage state={{ error: state.error }} /> : null}
      {state.results ? (
        state.results.length === 0 ? (
          <EmptyState>No patients you can open match that. A new patient needs a record first: invite them from Team and settings.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border border border-surface-border" aria-live="polite">
            {state.results.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  {p.name}
                  <span className="type-small text-content-muted">
                    {" "}
                    · {p.clinicRef} · born {formatDate(p.dateOfBirth)}
                  </span>
                </span>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/clinic/patients/${p.id}/book`} aria-label={`Book for ${p.name}`}>
                    Book
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
