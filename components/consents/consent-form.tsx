"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { setConsent, type ConsentFormState } from "@/lib/consents/actions";
import type { ConsentType } from "@/lib/consents/constants";

const initial: ConsentFormState = {};

/** One consent: give or withdraw. A button, not a switch, because each change is recorded. */
export function ConsentChoice({ patientId, type, granted }: { patientId: string; type: ConsentType; granted: boolean | null }) {
  const [state, action, pending] = useActionState(setConsent, initial);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="granted" value={granted ? "no" : "yes"} />
      <Button type="submit" variant={granted ? "outline" : "primary"} size="sm" loading={pending}>
        {granted ? "Withdraw consent" : "Give consent"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
