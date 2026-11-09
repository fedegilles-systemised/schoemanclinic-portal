"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";

import { Field } from "@/components/auth/form-parts";
import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { EntryOptions } from "@/lib/data/results";
import { enterReport, type ResultsFormState } from "@/lib/results/actions";

const initial: ResultsFormState = {};

type Row = { key: number; markerId: string; value: string; unit: string };

type Props = {
  options: EntryOptions;
  /** A file already waiting in the queue, so its values are entered against it. */
  queued?: { importId: string; documentId: string; title: string; patientId: string | null };
};

export function EntryForm({ options, queued }: Props) {
  const [state, action, pending] = useActionState(enterReport, initial);
  const [patientId, setPatientId] = useState(queued?.patientId ?? "");
  const [rows, setRows] = useState<Row[]>([{ key: 1, markerId: "", value: "", unit: "" }]);
  const [nextKey, setNextKey] = useState(2);

  const markerOf = (id: string) => options.markers.find((m) => m.id === id);
  const update = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const addRow = () => {
    setRows((current) => [...current, { key: nextKey, markerId: "", value: "", unit: "" }]);
    setNextKey((n) => n + 1);
  };

  const submittedRows = JSON.stringify(
    rows.filter((row) => row.markerId || row.value).map(({ markerId, value, unit }) => ({ markerId, value, unit })),
  );

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5">
      <input type="hidden" name="rows" value={submittedRows} />
      {queued ? (
        <>
          <input type="hidden" name="importId" value={queued.importId} />
          <input type="hidden" name="documentId" value={queued.documentId} />
          <p className="type-body text-content-muted">
            Entering the values from <strong className="text-content">{queued.title}</strong>.
          </p>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="patientId" label="Patient">
          <Select
            id="patientId"
            name="patientId"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            disabled={Boolean(queued?.patientId)}
            required
          >
            <option value="" disabled>
              Choose a patient
            </option>
            {options.patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} · {patient.clinicRef}
              </option>
            ))}
          </Select>
          {queued?.patientId ? <input type="hidden" name="patientId" value={queued.patientId} /> : null}
        </Field>
        <Field id="sampleDate" label="Sample date">
          <Input id="sampleDate" name="sampleDate" type="date" required />
        </Field>
        <Field id="labName" label="Lab (optional)">
          <Input id="labName" name="labName" maxLength={120} autoComplete="off" />
        </Field>
        {queued ? null : (
          <Field id="file" label="The lab's report (optional)">
            <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" />
          </Field>
        )}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-eyebrow mb-1 text-content-muted">Results</legend>
        {rows.map((row) => {
          const marker = markerOf(row.markerId);
          const units = marker ? [...(marker.unit ? [marker.unit] : []), ...marker.otherUnits] : [];
          return (
            <div key={row.key} className="grid grid-cols-[1fr_7rem_8rem_auto] items-end gap-2 max-sm:grid-cols-2">
              <Field id={`marker-${row.key}`} label="Marker">
                <Select
                  id={`marker-${row.key}`}
                  value={row.markerId}
                  onChange={(event) => update(row.key, { markerId: event.target.value, unit: markerOf(event.target.value)?.unit ?? "" })}
                >
                  <option value="" disabled>
                    Choose
                  </option>
                  {options.markers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`value-${row.key}`} label="Value">
                <Input
                  id={`value-${row.key}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={row.value}
                  onChange={(event) => update(row.key, { value: event.target.value })}
                />
              </Field>
              <Field id={`unit-${row.key}`} label="Unit">
                <Select id={`unit-${row.key}`} value={row.unit} onChange={(event) => update(row.key, { unit: event.target.value })} disabled={units.length === 0}>
                  {units.length === 0 ? <option value="">-</option> : null}
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                aria-label="Remove this row"
                onClick={() => setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== row.key) : current))}
              >
                <X aria-hidden />
              </Button>
            </div>
          );
        })}
        <div>
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus aria-hidden />
            Add a result
          </Button>
        </div>
        <p className="type-small text-content-muted">
          Values in another unit are converted to the clinic&apos;s UK unit, and the original is kept.
        </p>
      </fieldset>

      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Send for review
        </Button>
      </div>
    </form>
  );
}
