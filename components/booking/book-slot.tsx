"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { bookAppointment, cancelAppointment, type BookingFormState } from "@/lib/booking/actions";

const initial: BookingFormState = {};

/** One free time. Choosing it books it straight away, after a confirmation. */
export function BookSlotButton(props: {
  patientId: string;
  staffId: string;
  typeId: string;
  startsAt: string;
  locationId: string | null;
  back: "portal" | "clinic";
  label: string;
  ariaLabel: string;
  confirmText: string;
}) {
  const [state, action, pending] = useActionState(bookAppointment, initial);
  return (
    <form action={action}>
      <input type="hidden" name="patientId" value={props.patientId} />
      <input type="hidden" name="staffId" value={props.staffId} />
      <input type="hidden" name="typeId" value={props.typeId} />
      <input type="hidden" name="startsAt" value={props.startsAt} />
      {props.locationId ? <input type="hidden" name="locationId" value={props.locationId} /> : null}
      <input type="hidden" name="back" value={props.back} />
      <ConfirmButton
        variant="outline"
        size="sm"
        loading={pending}
        aria-label={props.ariaLabel}
        confirmTitle="Book this appointment?"
        confirmText={props.confirmText}
        confirmLabel="Book"
      >
        {props.label}
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function CancelAppointmentButton({ appointmentId, patientId, label }: { appointmentId: string; patientId: string; label: string }) {
  const [state, action, pending] = useActionState(cancelAppointment, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <ConfirmButton
        variant="destructive"
        size="sm"
        loading={pending}
        aria-label={`Cancel appointment: ${label}`}
        confirmTitle={`Cancel ${label}?`}
        confirmText="A message goes to the patient where their choices allow."
      >
        Cancel appointment
      </ConfirmButton>
      <FormMessage state={state} />
    </form>
  );
}
