"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Clock, FileText, TriangleAlert } from "lucide-react";

import { FormMessage } from "@/components/profile/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import type { SignatureRxPanel } from "@/lib/data/signaturerx";
import { formatDate, formatTime } from "@/lib/format";
import { checkSignatureRxStatus, resolveSignatureRxSend, sendToSignatureRx, type SignatureRxFormState } from "@/lib/signaturerx/actions";
import { SRX_ACTIONS, SRX_CLOSED_STATUSES, SRX_FINAL_STATUSES, srxStatusLabel } from "@/lib/signaturerx/constants";

const initial: SignatureRxFormState = {};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="type-small text-content-muted">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <StatusPill tone="neutral" icon={Clock} label="Not checked yet" />;
  const done = status === "signed" || status === "dispensed" || status === "collected" || status === "shipped" || status === "dispatched";
  const bad = status === "voided" || status === "expired" || status === "failed";
  return (
    <StatusPill
      tone={bad ? "danger" : done ? "success" : "info"}
      icon={bad ? TriangleAlert : done ? CircleCheck : FileText}
      label={srxStatusLabel(status)}
    />
  );
}

function CheckStatusButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(checkSignatureRxStatus, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Check SignatureRx
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** For a send SignatureRx never confirmed: record that it was created, or close it so it can be sent again. */
function ResolveSend({ id, requestId }: { id: string; requestId: string }) {
  const [confirmState, confirmAction, confirming] = useActionState(resolveSignatureRxSend, initial);
  const [closeState, closeAction, closing] = useActionState(resolveSignatureRxSend, initial);
  return (
    <div className="flex flex-col gap-4 border-t border-surface-border pt-4">
      <p className="type-small">Look for this prescription in SignatureRx, then say what you found.</p>
      <form action={confirmAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="mode" value="confirm" />
        <Field id={`srx-found-${id}`} label="It is there: its SignatureRx id">
          <Input id={`srx-found-${id}`} name="value" maxLength={100} autoComplete="off" required />
        </Field>
        <div>
          <Button type="submit" size="sm" variant="outline" loading={confirming}>
            Record it
          </Button>
        </div>
        <FormMessage state={confirmState} />
      </form>
      <form action={closeAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="mode" value="close" />
        <Field id={`srx-missing-${id}`} label="It is not there: what you found">
          <Input id={`srx-missing-${id}`} name="value" maxLength={200} autoComplete="off" required />
        </Field>
        <div>
          <ConfirmButton
            size="sm"
            variant="outline"
            loading={closing}
            confirmTitle="Close this send?"
            confirmText="The request can then be sent again. Only do this if you looked in SignatureRx and the prescription is not there."
            confirmLabel="Close it"
          >
            Close it so it can be sent again
          </ConfirmButton>
        </div>
        <FormMessage state={closeState} />
      </form>
    </div>
  );
}

type Row = { description: string; qty: string; directions: string };

function SendForm({ requestId, itemNames, hasCode }: { requestId: string; itemNames: string[]; hasCode: boolean }) {
  const [state, action, pending] = useActionState(sendToSignatureRx, initial);
  const [rows, setRows] = useState<Row[]>(itemNames.map((name) => ({ description: name, qty: "", directions: "" })));
  const change = (index: number, key: keyof Row, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    // The key remounts the form after a send, so the PIN field is always empty again.
    <form action={action} className="flex flex-col gap-5" key={state.sentAt ?? "send"} autoComplete="off">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="medicines" value={JSON.stringify(rows)} />

      <div className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <fieldset key={index} className="flex flex-col gap-3 border border-surface-border p-4">
            <legend className="type-eyebrow px-1 text-content-muted">Medicine {index + 1}</legend>
            <Field id={`srx-description-${index}`} label="Medicine, as SignatureRx should print it">
              <Input id={`srx-description-${index}`} value={row.description} maxLength={200} required onChange={(e) => change(index, "description", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`srx-qty-${index}`} label="Quantity to supply" hint="For example 30 tablets, or 2 pens.">
                <Input id={`srx-qty-${index}`} value={row.qty} maxLength={60} required onChange={(e) => change(index, "qty", e.target.value)} />
              </Field>
              <Field id={`srx-directions-${index}`} label="Directions">
                <Input id={`srx-directions-${index}`} value={row.directions} maxLength={500} required onChange={(e) => change(index, "directions", e.target.value)} />
              </Field>
            </div>
          </fieldset>
        ))}
      </div>

      <Field id="srx-action" label="What to do with it">
        <Select id="srx-action" name="action" defaultValue="draft">
          {SRX_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </Field>

      {!hasCode ? (
        <Field id="srx-code" label="Your SignatureRx integration code" hint="Asked for once. It is kept on the server and never shown again.">
          <Input id="srx-code" name="integrationCode" type="password" autoComplete="new-password" maxLength={200} required />
        </Field>
      ) : null}

      <Field id="srx-pin" label="Your signing PIN" hint="Six digits. It goes straight to SignatureRx. Clinic Hub does not keep it or write it down.">
        <Input id="srx-pin" name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required className="max-w-40" />
      </Field>

      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Send to SignatureRx
        </Button>
      </div>
    </form>
  );
}

/**
 * The SignatureRx part of a repeat request: what has been sent and its state, and for a doctor the
 * form that sends an approved request. Shown only when SignatureRx is set up.
 */
export function SignatureRxSection({
  requestId,
  itemNames,
  panel,
  isDoctor,
  canCheck,
  canResolve,
  approved,
  names,
}: {
  requestId: string;
  itemNames: string[];
  panel: SignatureRxPanel;
  isDoctor: boolean;
  canCheck: boolean;
  /** An admin or a doctor: the database narrows it to those allowed for this patient. */
  canResolve: boolean;
  approved: boolean;
  names: Record<string, string>;
}) {
  if (!panel.configured && panel.sent.length === 0) return null;
  // One open send for a request: after a draft, a send that is under way or one SignatureRx has not
  // confirmed, the doctor looks in SignatureRx instead. A failed, voided or expired one can be redone.
  const open = panel.sent.some((p) => !SRX_CLOSED_STATUSES.has(p.status ?? ""));
  const showForm = isDoctor && approved && panel.signingEnabled && panel.missing.length === 0 && !open;

  return (
    <Card className="mb-6">
      <CardTitle>SignatureRx</CardTitle>
      <CardContent className="flex flex-col gap-5">
        {panel.sent.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {panel.sent.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 border border-surface-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={p.status} />
                  {p.srxPrescriptionId ? <span className="type-body">{p.srxPrescriptionId}</span> : null}
                </div>
                <p className="type-small text-content-muted">
                  {p.action === "draft" ? "Saved as a draft" : "Signed and issued"} by {names[p.sentBy] ?? "a former team member"} on {formatDate(p.sentAt)} at{" "}
                  {formatTime(p.sentAt)}.{" "}
                  {p.lastCheckedAt ? `Last checked ${formatDate(p.lastCheckedAt)} at ${formatTime(p.lastCheckedAt)}.` : "Not checked since it was sent."}
                </p>
                {p.status === "failed" && p.lastError ? <p className="type-small">{p.lastError}</p> : null}
                {p.status === "sending" ? (
                  <p className="type-small">SignatureRx has not confirmed this send. Look for it in SignatureRx before anyone sends it again.</p>
                ) : null}
                {p.status === "sending" && canResolve ? <ResolveSend id={p.id} requestId={requestId} /> : null}
                {canCheck && p.srxPrescriptionId && !(p.status && SRX_FINAL_STATUSES.has(p.status)) ? <CheckStatusButton id={p.id} /> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {isDoctor && approved && panel.configured && !panel.signingEnabled ? (
          <p className="type-small text-content-muted">Sending to SignatureRx is switched off for now.</p>
        ) : null}

        {isDoctor && approved && panel.signingEnabled && panel.missing.length > 0 ? (
          <Alert variant="warning">
            <TriangleAlert aria-hidden />
            <AlertDescription>The patient&apos;s record still needs {panel.missing.join(", ")} before this can be sent. Ask a PA to add it on their record.</AlertDescription>
          </Alert>
        ) : null}

        {showForm ? <SendForm requestId={requestId} itemNames={itemNames} hasCode={panel.hasCode} /> : null}
      </CardContent>
    </Card>
  );
}
