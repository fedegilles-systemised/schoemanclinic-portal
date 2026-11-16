"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { disconnectWearable, type WearableFormState } from "@/lib/wearables/actions";

const initial: WearableFormState = {};

/** Unlinks one wearable. The readings already saved stay on the record. */
export function DisconnectButton({ patientId, provider, label }: { patientId: string; provider: "oura" | "whoop"; label: string }) {
  const [state, action, pending] = useActionState(disconnectWearable, initial);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="provider" value={provider} />
      <ConfirmButton
        size="sm"
        variant="outline"
        loading={pending}
        aria-label={`Disconnect ${label}`}
        confirmVariant="destructive"
        confirmTitle={`Disconnect ${label}?`}
        confirmText="Clinic Hub stops reading your figures. What was already saved stays on your record."
        confirmLabel="Disconnect"
      >
        Disconnect
      </ConfirmButton>
      <FormMessage state={state} />
    </form>
  );
}
