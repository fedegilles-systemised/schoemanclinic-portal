"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { rejectLabFile, unmatchLabFile, type ResultsFormState } from "@/lib/results/actions";

const initial: ResultsFormState = {};

/** A PA or admin turns away a waiting file, saying why. The file is archived, not deleted. */
export function RejectFileForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(rejectLabFile, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="importId" value={importId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="reason" aria-label="Why this file is turned away" placeholder="Why it is turned away" maxLength={200} className="max-w-64" />
        <ConfirmButton
          size="sm"
          variant="outline"
          loading={pending}
          confirmVariant="destructive"
          confirmTitle="Reject this file?"
          confirmText="It leaves the queue and is archived with your reason. Nothing is deleted."
          confirmLabel="Reject it"
        >
          Reject
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** A lab file matched to the wrong patient goes back to the queue. Only before values are entered. */
export function UnmatchFileForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(unmatchLabFile, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="importId" value={importId} />
      <div>
        <ConfirmButton
          size="sm"
          variant="outline"
          loading={pending}
          confirmTitle="Take this file back?"
          confirmText="It leaves this patient and goes back to the queue, waiting for a match. Do this only if it was matched to the wrong person."
          confirmLabel="Take it back"
        >
          Wrong patient
        </ConfirmButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
