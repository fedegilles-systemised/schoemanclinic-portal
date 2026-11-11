"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
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

export function ShareDocumentButton({ documentId, patientId, shared }: { documentId: string; patientId: string; shared: boolean }) {
  const [state, action, pending] = useActionState(setDocumentShared, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="share" value={shared ? "no" : "yes"} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {shared ? "Stop sharing" : "Share"}
      </Button>
      {state.error || state.saved ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function ArchiveDocumentButton({ documentId, patientId }: { documentId: string; patientId: string }) {
  const [state, action, pending] = useActionState(archiveDocument, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        Remove
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
