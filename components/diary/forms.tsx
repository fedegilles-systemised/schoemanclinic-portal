"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { moveAppointment, type DiaryFormState } from "@/lib/diary/actions";

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
        <ConfirmButton variant="outline" size="sm" loading={pending} confirmTitle="Move this appointment?" confirmText="The patient is told the new time, and the clinicians' calendars are updated.">
          Move appointment
        </ConfirmButton>
      </div>
    </form>
  );
}
