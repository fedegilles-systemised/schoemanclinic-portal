"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { archiveDocument, setDocumentShared, uploadDocument, type DocumentFormState } from "@/lib/documents/actions";
import { DOCUMENT_KIND_LABELS, UPLOAD_KINDS } from "@/lib/documents/constants";

const initial: DocumentFormState = {};

export function UploadDocumentForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(uploadDocument, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={state.sentAt ?? "upload"}>
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-title">Title</Label>
        <Input id="document-title" name="title" maxLength={120} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-kind">Kind</Label>
        <Select id="document-kind" name="kind" defaultValue="letter">
          {UPLOAD_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {DOCUMENT_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="document-file">File (PDF, JPEG or PNG, up to 10 MB)</Label>
        <Input id="document-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
      </div>
      <label className="type-body flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="share" className="size-4 accent-secondary" />
        Share with the patient now
      </label>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Add document
        </Button>
      </div>
    </form>
  );
}

export function ShareDocumentButton({ documentId, patientId, shared, title }: { documentId: string; patientId: string; shared: boolean; title: string }) {
  const [state, action, pending] = useActionState(setDocumentShared, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="share" value={shared ? "no" : "yes"} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`${shared ? "Stop sharing" : "Share"}: ${title}`}
        confirmTitle={shared ? `Stop sharing ${title}?` : `Share ${title} with the patient?`}
        confirmText={shared ? "The patient stops seeing it straight away." : "The patient sees it in their portal and is told a new document is there."}
        confirmVariant={shared ? "destructive" : "primary"}
      >
        {shared ? "Stop sharing" : "Share"}
      </ConfirmButton>
      {state.error || state.saved ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function ArchiveDocumentButton({ documentId, patientId, title }: { documentId: string; patientId: string; title: string }) {
  const [state, action, pending] = useActionState(archiveDocument, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`Remove: ${title}`}
        confirmVariant="destructive"
        confirmTitle="Remove this document?"
        confirmText="It is archived, not deleted, and the patient no longer sees it."
      >
        Remove
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
