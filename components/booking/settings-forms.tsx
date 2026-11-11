"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addAppointmentType, addHours, removeHours, setTypeActive, type SettingsFormState } from "@/lib/booking/settings-actions";

const initial: SettingsFormState = {};
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function AddTypeForm() {
  const [state, action, pending] = useActionState(addAppointmentType, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type-name">Name</Label>
        <Input id="type-name" name="name" maxLength={120} placeholder="Follow-up consultation" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type-duration">Length (minutes)</Label>
        <Input id="type-duration" name="durationMin" type="number" min={5} max={480} step={5} defaultValue={30} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type-kind">Where</Label>
        <Select id="type-kind" name="locationKind" defaultValue="video">
          <option value="video">Video</option>
          <option value="clinic">In clinic</option>
        </Select>
      </div>
      <label className="type-body flex items-center gap-2 self-end">
        <input type="checkbox" name="bookableByPatients" defaultChecked />
        Patients can book it online
      </label>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Add appointment type
        </Button>
      </div>
    </form>
  );
}

export function TypeActiveButton({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [state, action, pending] = useActionState(setTypeActive, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`${active ? "Stop offering" : "Offer again"}: ${name}`}>
        {active ? "Stop offering" : "Offer again"}
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function AddHoursForm({ clinicians, locations }: { clinicians: { id: string; name: string }[]; locations: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addHours, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-5">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="hours-staff">Clinician</Label>
        <Select id="hours-staff" name="staffId" required defaultValue={clinicians.length === 1 ? clinicians[0].id : ""}>
          <option value="" disabled>
            Choose a clinician
          </option>
          {clinicians.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hours-day">Day</Label>
        <Select id="hours-day" name="weekday" defaultValue="1">
          {WEEKDAYS.map((day, i) => (
            <option key={day} value={i + 1}>
              {day}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hours-start">From</Label>
        <Input id="hours-start" name="start" type="time" defaultValue="09:00" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hours-end">To</Label>
        <Input id="hours-end" name="end" type="time" defaultValue="17:00" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="hours-location">Location (optional)</Label>
        <Select id="hours-location" name="locationId" defaultValue="">
          <option value="">Any</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-5">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" variant="outline" loading={pending}>
          Add hours
        </Button>
      </div>
    </form>
  );
}

export function RemoveHoursButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(removeHours, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton
        variant="destructive"
        size="sm"
        loading={pending}
        aria-label={`Remove: ${label}`}
        confirmTitle={`Remove ${label}?`}
        confirmText="Patients stop seeing these times straight away."
      >
        Remove
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
