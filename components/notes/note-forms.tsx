"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { archiveDraft, createNote, signNote, updateNote, type NoteFormState } from "@/lib/notes/actions";

const initial: NoteFormState = {};

function Fields({ idPrefix, title, body }: { idPrefix: string; title: string; body: string }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input id={`${idPrefix}-title`} name="title" defaultValue={title} maxLength={200} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-body`}>Note</Label>
        <Textarea id={`${idPrefix}-body`} name="body" defaultValue={body} maxLength={50000} className="min-h-48" required />
      </div>
    </>
  );
}

/** A new draft note. */
export function NewNoteForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createNote, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="patientId" value={patientId} />
      <Fields idPrefix="new-note" title="" body="" />
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save draft
        </Button>
      </div>
    </form>
  );
}

/** The author's own draft: edit, sign or discard. */
export function DraftForm({ patientId, noteId, title, body }: { patientId: string; noteId: string; title: string; body: string }) {
  const [saveState, saveAction, saving] = useActionState(updateNote, initial);
  const [signState, signAction, signing] = useActionState(signNote, initial);
  const [discardState, discardAction, discarding] = useActionState(archiveDraft, initial);
  const state = signState.error || signState.saved ? signState : discardState.error || discardState.saved ? discardState : saveState;
  return (
    <div className="flex flex-col gap-4">
      <form action={saveAction} className="flex flex-col gap-4">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="noteId" value={noteId} />
        <Fields idPrefix={`draft-${noteId}`} title={title} body={body} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" loading={saving}>
            Save draft
          </Button>
          {/* Signs exactly what is on screen: the action saves this text first. */}
          <ConfirmButton
            formAction={signAction}
            loading={signing}
            confirmTitle="Sign this note?"
            confirmText="Once signed it is final: nobody can change or correct it."
          >
            Sign and lock
          </ConfirmButton>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={discardAction}>
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="noteId" value={noteId} />
          <ConfirmButton
            variant="destructive"
            loading={discarding}
            confirmTitle="Discard this draft?"
            confirmText="It is kept in the record's history but no longer shown."
          >
            Discard draft
          </ConfirmButton>
        </form>
      </div>
      <p className="type-small text-content-muted">Signing saves what is on screen and makes it final. Nobody can change or correct a signed note.</p>
      <FormMessage state={state} />
    </div>
  );
}
