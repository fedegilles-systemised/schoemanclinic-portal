"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addReading, archiveReading, type WearableFormState } from "@/lib/wearables/actions";
import { WEARABLE_METRIC_KEYS, WEARABLE_METRICS } from "@/lib/wearables/metrics";

const initial: WearableFormState = {};

export function ReadingForm({ patientId, today }: { patientId: string; today: string }) {
  const [state, action, pending] = useActionState(addReading, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reading-metric">What you are recording</Label>
        <Select id="reading-metric" name="metric" required defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          {WEARABLE_METRIC_KEYS.map((key) => (
            <option key={key} value={key}>
              {WEARABLE_METRICS[key].label} ({WEARABLE_METRICS[key].unit})
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reading-value">Value</Label>
        <Input id="reading-value" name="value" inputMode="decimal" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reading-date">Date</Label>
        <Input id="reading-date" name="measuredOn" type="date" defaultValue={today} max={today} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reading-device">Device (optional)</Label>
        <Input id="reading-device" name="device" placeholder="Oura, Whoop, Garmin" maxLength={80} />
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save reading
        </Button>
      </div>
    </form>
  );
}

export function RemoveReadingButton({ readingId }: { readingId: string }) {
  const [state, action, pending] = useActionState(archiveReading, initial);
  return (
    <form action={action}>
      <input type="hidden" name="readingId" value={readingId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        Remove
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
