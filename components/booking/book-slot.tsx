"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { bookAppointment, cancelAppointment, markNoShow, undoNoShow, type BookingFormState } from "@/lib/booking/actions";

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

/** The patient did not come. It asks first, because the visit then shows as a no-show on their record. */
export function NoShowButton({ appointmentId, patientId, label }: { appointmentId: string; patientId: string; label: string }) {
  const [state, action, pending] = useActionState(markNoShow, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <div>
        <ConfirmButton
          variant="outline"
          loading={pending}
          aria-label={`Mark as did not attend: ${label}`}
          confirmTitle="Mark as did not attend?"
          confirmText="The visit shows as a no-show on the diary and the patient's record. A visit that has ended and is not marked counts as completed. A PA or an admin can put this right."
          confirmLabel="Mark as did not attend"
        >
          Did not attend
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** A PA or admin puts a wrong no-show right. The visit goes back to counting as attended. */
export function UndoNoShowButton({ appointmentId, patientId, label }: { appointmentId: string; patientId: string; label: string }) {
  const [state, action, pending] = useActionState(undoNoShow, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <div>
        <ConfirmButton
          variant="outline"
          loading={pending}
          aria-label={`Remove no-show: ${label}`}
          confirmTitle="Remove the no-show?"
          confirmText="The visit no longer shows as a no-show. It counts as attended again."
          confirmLabel="Remove no-show"
        >
          Remove no-show
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
