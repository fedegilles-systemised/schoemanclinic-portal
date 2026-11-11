"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
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

/** A new note, or a correction of a signed note (then supersedesId is set and the text starts from it). */
export function NewNoteForm({
  patientId,
  supersedesId,
  title = "",
  body = "",
  onDone,
}: {
  patientId: string;
  supersedesId?: string;
  title?: string;
  body?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (previous: NoteFormState, formData: FormData) => {
    const result = await createNote(previous, formData);
    if (result.saved) onDone?.();
    return result;
  }, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="patientId" value={patientId} />
      {supersedesId ? <input type="hidden" name="supersedesId" value={supersedesId} /> : null}
      <Fields idPrefix={supersedesId ? `correct-${supersedesId}` : "new-note"} title={title} body={body} />
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          {supersedesId ? "Save correction as a draft" : "Save draft"}
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
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={signAction}>
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="noteId" value={noteId} />
          <Button type="submit" loading={signing}>
            Sign and lock
          </Button>
        </form>
        <form action={discardAction}>
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="noteId" value={noteId} />
          <Button type="submit" variant="ghost" loading={discarding}>
            Discard draft
          </Button>
        </form>
      </div>
      <p className="type-small text-content-muted">Save your changes before signing. Once signed, a note cannot be changed; a correction becomes a new version.</p>
      <FormMessage state={state} />
    </div>
  );
}

export function CorrectNote({ patientId, noteId, title, body }: { patientId: string; noteId: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Write a correction
      </Button>
    );
  }
  return <NewNoteForm patientId={patientId} supersedesId={noteId} title={title} body={body} onDone={() => setOpen(false)} />;
}
