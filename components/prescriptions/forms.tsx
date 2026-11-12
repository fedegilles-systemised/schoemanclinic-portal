"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";

import { FormMessage } from "@/components/profile/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addListMedicine,
  addMedication,
  cancelRepeat,
  changeMedication,
  decideRepeat,
  setListMedicineArchived,
  type PrescriptionFormState,
} from "@/lib/prescriptions/actions";
import type { RequestStatus } from "@/lib/prescriptions/constants";

const initial: PrescriptionFormState = {};

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function WithdrawRequestButton({ requestId, byClinic = false }: { requestId: string; byClinic?: boolean }) {
  const [state, action, pending] = useActionState(cancelRepeat, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <ConfirmButton
          variant="outline"
          loading={pending}
          confirmTitle="Withdraw this request?"
          confirmText={
            byClinic
              ? "It leaves the to-do list and the patient sees it as withdrawn. They can make a new request at any time."
              : "The clinic will not see it. You can make a new request at any time."
          }
        >
          Withdraw request
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** The team's next step on a request. Only the moves the database allows from here are offered. */
export function DecisionForm({ requestId, status, paid }: { requestId: string; status: RequestStatus; paid: boolean }) {
  const [state, action, pending] = useActionState(decideRepeat, initial);
  const options: { value: RequestStatus; label: string }[] =
    status === "requested"
      ? [
          { value: "approved", label: "Approve" },
          { value: "sent_to_pharmacy", label: "Mark as sent to the pharmacy" },
          { value: "declined", label: "Decline" },
        ]
      : [
          { value: "sent_to_pharmacy", label: "Mark as sent to the pharmacy" },
          { value: "declined", label: "Decline" },
        ];
  return (
    <form action={action} className="flex flex-col gap-4" key={state.sentAt ?? "decision"}>
      <input type="hidden" name="requestId" value={requestId} />
      {!paid ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>This request has not been paid for online. Check payment before you go ahead.</AlertDescription>
        </Alert>
      ) : null}
      <Field id="decision-status" label="Next step">
        <Select id="decision-status" name="status" defaultValue={options[0]?.value}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="decision-note" label="Note to the patient (needed when declining)">
        <Textarea id="decision-note" name="note" maxLength={2000} />
      </Field>
      <p className="type-small text-content-muted">The patient is told the request has moved on. They read your note in the portal, not in the email.</p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save next step
        </Button>
      </div>
    </form>
  );
}

export function AddMedicationForm({ patientId, today, listNames }: { patientId: string; today: string; listNames: string[] }) {
  const [state, action, pending] = useActionState(addMedication, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={state.sentAt ?? "medication"}>
      <input type="hidden" name="patientId" value={patientId} />
      <Field id="med-name" label="Medicine">
        <Input id="med-name" name="name" maxLength={200} list="clinic-medicine-list" required />
        <datalist id="clinic-medicine-list">
          {listNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      <Field id="med-dose" label="Dose (optional)">
        <Input id="med-dose" name="dose" maxLength={120} />
      </Field>
      <Field id="med-kind" label="Type">
        <Select id="med-kind" name="kind" defaultValue="prescription">
          <option value="prescription">Prescription</option>
          <option value="supplement">Supplement</option>
        </Select>
      </Field>
      <Field id="med-pharmacy" label="Pharmacy (optional)">
        <Input id="med-pharmacy" name="pharmacy" maxLength={200} />
      </Field>
      <Field id="med-start" label="Supply starts">
        <Input id="med-start" name="startDate" type="date" defaultValue={today} required />
      </Field>
      <Field id="med-days" label="Supply lasts (days)">
        <Input id="med-days" name="supplyDays" type="number" min={1} max={730} defaultValue={30} required />
      </Field>
      <div className="sm:col-span-2">
        <Field id="med-instructions" label="Instructions (optional)">
          <Input id="med-instructions" name="instructions" maxLength={500} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Add medicine
        </Button>
      </div>
    </form>
  );
}

/** Renew a supply, or pause, stop or restart a medicine. */
export function ChangeMedicationForm({
  patientId,
  medication,
}: {
  patientId: string;
  medication: { id: string; name: string; status: "active" | "paused" | "stopped"; startDate: string; supplyDays: number };
}) {
  const [state, action, pending] = useActionState(changeMedication, initial);
  const id = medication.id;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end" key={state.sentAt ?? id}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="medicationId" value={id} />
      <Field id={`status-${id}`} label="Status">
        <Select id={`status-${id}`} name="status" defaultValue={medication.status}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
        </Select>
      </Field>
      <Field id={`start-${id}`} label="Supply starts">
        <Input id={`start-${id}`} name="startDate" type="date" defaultValue={medication.startDate} max="2100-12-31" required />
      </Field>
      <Field id={`days-${id}`} label="Days">
        <Input id={`days-${id}`} name="supplyDays" type="number" min={1} max={730} defaultValue={medication.supplyDays} required />
      </Field>
      <div>
        <Button type="submit" size="sm" variant="outline" loading={pending} aria-label={`Save ${medication.name}`}>
          Save
        </Button>
      </div>
      {state.error || state.saved ? (
        <div className="sm:col-span-4">
          <FormMessage state={state} />
        </div>
      ) : null}
      <p className="type-small text-content-muted sm:col-span-4">To renew a supply, set the day the new supply starts and how long it lasts.</p>
    </form>
  );
}

export function AddListMedicineForm() {
  const [state, action, pending] = useActionState(addListMedicine, initial);
  return (
    <form action={action} className="flex flex-col gap-4" key={state.sentAt ?? "list"}>
      <Field id="list-name" label="Medicine">
        <Input id="list-name" name="name" maxLength={120} required />
      </Field>
      <label className="type-body flex items-center gap-2">
        <input type="checkbox" name="weightLoss" className="size-4 accent-secondary" />
        A weight-loss medicine (asks the weight and side-effect questions)
      </label>
      <FormMessage state={state} />
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Add to the list
        </Button>
      </div>
    </form>
  );
}

export function ListMedicineToggle({ medicineId, name, archived }: { medicineId: string; name: string; archived: boolean }) {
  const [state, action, pending] = useActionState(setListMedicineArchived, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="medicineId" value={medicineId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <Button type="submit" size="sm" variant="ghost" loading={pending} aria-label={archived ? `Put ${name} back on the list` : `Take ${name} off the list`}>
        {archived ? "Put back" : "Take off the list"}
      </Button>
      {state.error ? <span className="type-small text-status-danger">{state.error}</span> : null}
    </form>
  );
}
