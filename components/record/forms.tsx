"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addAllergy,
  addDiagnosis,
  addSafeguardingAlert,
  removeAllergy,
  resolveSafeguardingAlert,
  setDiagnosisStatus,
  type RecordFormState,
} from "@/lib/record/actions";
import { ALLERGY_SEVERITIES, DIAGNOSIS_STATUS_LABELS, DIAGNOSIS_STATUSES, SEVERITIES, SEVERITY_LABELS, type DiagnosisStatus } from "@/lib/record/constants";

const initial: RecordFormState = {};

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function AllergyForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(addAllergy, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" key={state.sentAt ?? "allergy"}>
      <input type="hidden" name="patientId" value={patientId} />
      <Field id="allergy-substance" label="Substance">
        <Input id="allergy-substance" name="substance" maxLength={120} required />
      </Field>
      <Field id="allergy-reaction" label="Reaction (optional)">
        <Input id="allergy-reaction" name="reaction" maxLength={200} />
      </Field>
      <Field id="allergy-severity" label="Severity (optional)">
        <Select id="allergy-severity" name="severity" defaultValue="">
          <option value="">Not known</option>
          {ALLERGY_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Add allergy
        </Button>
      </div>
    </form>
  );
}

export function RemoveAllergyButton({ patientId, allergyId, substance }: { patientId: string; allergyId: string; substance: string }) {
  const [state, action, pending] = useActionState(removeAllergy, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="allergyId" value={allergyId} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`Remove allergy: ${substance}`}
        confirmVariant="destructive"
        confirmTitle={`Remove ${substance}?`}
        confirmText="Only remove an allergy entered by mistake. It is kept in the record's history but no longer shown. To change one, remove it and add it again."
      >
        Remove
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function DiagnosisForm({ patientId, today }: { patientId: string; today: string }) {
  const [state, action, pending] = useActionState(addDiagnosis, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={state.sentAt ?? "diagnosis"}>
      <input type="hidden" name="patientId" value={patientId} />
      <Field id="diagnosis-label" label="Diagnosis">
        <Input id="diagnosis-label" name="label" maxLength={160} required />
      </Field>
      <Field id="diagnosis-code" label="ICD-10 code (optional)">
        <Input id="diagnosis-code" name="icd10Code" maxLength={8} placeholder="E03.9" />
      </Field>
      <Field id="diagnosis-status" label="Status">
        <Select id="diagnosis-status" name="status" defaultValue="active">
          {DIAGNOSIS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DIAGNOSIS_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="diagnosis-date" label="Diagnosed on (optional)">
        <Input id="diagnosis-date" name="diagnosedOn" type="date" max={today} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="diagnosis-notes" label="Notes (optional)">
          <Textarea id="diagnosis-notes" name="notes" maxLength={2000} className="min-h-20" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Add diagnosis
        </Button>
      </div>
    </form>
  );
}

export function DiagnosisStatusForm({ patientId, diagnosisId, status, label }: { patientId: string; diagnosisId: string; status: DiagnosisStatus; label: string }) {
  const [state, action, pending] = useActionState(setDiagnosisStatus, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="diagnosisId" value={diagnosisId} />
      <Select name="status" defaultValue={status} aria-label={`Status of ${label}`} className="w-auto">
        {DIAGNOSIS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DIAGNOSIS_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Save status of ${label}`}>
        Save
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function SafeguardingForm({ patientId, today }: { patientId: string; today: string }) {
  const [state, action, pending] = useActionState(addSafeguardingAlert, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" key={state.sentAt ?? "safeguarding"}>
      <input type="hidden" name="patientId" value={patientId} />
      <Field id="sg-type" label="Concern">
        <Input id="sg-type" name="alertType" maxLength={120} required />
      </Field>
      <Field id="sg-severity" label="Severity">
        <Select id="sg-severity" name="severity" defaultValue="" required>
          <option value="" disabled>
            Choose
          </option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="sg-review" label="Review by (optional)">
        <Input id="sg-review" name="reviewDue" type="date" min={today} />
      </Field>
      <div className="sm:col-span-3">
        <Field id="sg-note" label="Note">
          <Textarea id="sg-note" name="note" maxLength={4000} required className="min-h-20" />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Add alert
        </Button>
      </div>
    </form>
  );
}

export function ResolveAlertButton({ patientId, alertId, label }: { patientId: string; alertId: string; label: string }) {
  const [state, action, pending] = useActionState(resolveSafeguardingAlert, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="alertId" value={alertId} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`Mark resolved: ${label}`}
        confirmTitle="Mark this alert resolved?"
        confirmText="It stays on the record but no longer shows as active."
      >
        Mark resolved
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
