"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { removeGuardian, type GuardianFormState } from "@/lib/patients/guardian-actions";

const initial: GuardianFormState = {};

export function RemoveGuardianButton({ patientId, linkId, name }: { patientId: string; linkId: string; name: string }) {
  const [state, action, pending] = useActionState(removeGuardian, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="linkId" value={linkId} />
      <ConfirmButton
        variant="destructive"
        size="sm"
        loading={pending}
        aria-label={`Remove guardian: ${name}`}
        confirmTitle={`Remove ${name} as a guardian?`}
        confirmText="They will lose access to this patient's account straight away."
      >
        Remove guardian
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
