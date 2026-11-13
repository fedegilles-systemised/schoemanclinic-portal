"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { matchLabFile, type ResultsFormState } from "@/lib/results/actions";

const initial: ResultsFormState = {};

/** A PA picks the patient a waiting lab file belongs to. */
export function MatchFileForm({ importId, patients }: { importId: string; patients: { id: string; name: string; clinicRef: string }[] }) {
  const [state, action, pending] = useActionState(matchLabFile, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="importId" value={importId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select name="patientId" aria-label="Patient" defaultValue="" required className="max-w-64">
          <option value="" disabled>
            Choose a patient
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.clinicRef}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Match
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
