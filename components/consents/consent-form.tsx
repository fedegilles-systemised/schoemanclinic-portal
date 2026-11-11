"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { setConsent, type ConsentFormState } from "@/lib/consents/actions";
import { CONSENTS, type ConsentType } from "@/lib/consents/constants";

const initial: ConsentFormState = {};

/** One consent: give or withdraw. A button, not a switch, because each change is recorded. */
export function ConsentChoice({ patientId, type, granted }: { patientId: string; type: ConsentType; granted: boolean | null }) {
  const [state, action, pending] = useActionState(setConsent, initial);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="granted" value={granted ? "no" : "yes"} />
      <ConfirmButton
        variant={granted ? "outline" : "primary"}
        size="sm"
        loading={pending}
        aria-label={`${granted ? "Withdraw consent" : "Give consent"}: ${CONSENTS[type].title}`}
        confirmTitle={granted ? "Withdraw this consent?" : "Give this consent?"}
        confirmText={CONSENTS[type].description}
        confirmVariant={granted ? "destructive" : "primary"}
      >
        {granted ? "Withdraw consent" : "Give consent"}
      </ConfirmButton>
      <FormMessage state={state} />
    </form>
  );
}
