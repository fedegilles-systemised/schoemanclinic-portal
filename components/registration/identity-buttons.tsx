"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { checkIdentity, type RegistrationFormState } from "@/lib/registration/actions";

const initial: RegistrationFormState = {};

/** A PA or admin marks the photo ID as checked. It asks first, because the mark is permanent. */
export function CheckIdentityButton({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(checkIdentity, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <div>
        <ConfirmButton
          variant="outline"
          loading={pending}
          confirmTitle="Mark the identity as checked?"
          confirmText="Say this only after you have opened the photo ID and it matches the patient. It shows who checked it and when, and it cannot be changed."
          confirmLabel="Mark as checked"
        >
          Mark identity as checked
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
