"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Panel, RouteFee } from "@/lib/data/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { addPanel, cancelOrder, createOrder, recordSampleTaken, saveRouteFee, savePanel, type OrderFormState } from "@/lib/orders/actions";
import { ROUTE_LABELS, SEX_LABELS } from "@/lib/orders/constants";

const initial: OrderFormState = {};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="type-small text-content-muted">{hint}</p> : null}
    </div>
  );
}

/** A doctor or PA orders a panel. The price shown is the catalogue's; the database sets the real one. */
export function OrderForm({
  patientId,
  panels,
  fees,
  appointments,
}: {
  patientId: string;
  panels: Panel[];
  fees: RouteFee[];
  appointments: { id: string; startsAt: string; type: string }[];
}) {
  const [state, action, pending] = useActionState(createOrder, initial);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="patientId" value={patientId} />
      <Field id="order-panel" label="Panel">
        <Select id="order-panel" name="panelId" defaultValue="" required>
          <option value="" disabled>
            Choose a panel
          </option>
          {panels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name} · {formatMoney(p.pricePence)}
              {p.fasting ? " · fasting" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="order-route" label="How the sample is taken" hint="The fee for the way chosen is added to the panel price.">
        <Select id="order-route" name="route" defaultValue="" required>
          <option value="" disabled>
            Choose how
          </option>
          {fees.map((f) => (
            <option key={f.route} value={f.route}>
              {ROUTE_LABELS[f.route]} · adds {formatMoney(f.feePence)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="order-appointment" label="For the appointment" hint="The due date is 14 days before it.">
        <Select id="order-appointment" name="appointmentId" defaultValue="">
          <option value="">No appointment</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {formatDate(a.startsAt)} · {a.type}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="order-sample-date" label="Sample date (optional)" hint="Printed on the request form.">
        <Input id="order-sample-date" name="sampleDate" type="date" />
      </Field>
      <Field id="order-notes" label="Clinical notes (optional)" hint="Printed on the request form for the lab.">
        <Textarea id="order-notes" name="notes" maxLength={2000} />
      </Field>
      <p className="type-small text-content-muted">The patient is told by email, and by WhatsApp if they have it on. The email does not name the panel.</p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Order bloods
        </Button>
      </div>
    </form>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(cancelOrder, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <ConfirmButton
        variant="outline"
        loading={pending}
        confirmTitle="Cancel this order?"
        confirmText="The patient will no longer be able to pay for it. The order stays on the record as cancelled."
      >
        Cancel order
      </ConfirmButton>
      <FormMessage state={state} />
    </form>
  );
}

export function SampleTakenButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(recordSampleTaken, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <Button type="submit" variant="outline" loading={pending}>
          Sample taken
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function pounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Edit a panel, or add one when no panel is given. Admins only. */
export function PanelForm({ panel, labs }: { panel?: Panel; labs?: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(panel ? savePanel : addPanel, initial);
  const key = panel?.id ?? "new";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={state.sentAt ?? key}>
      {panel ? <input type="hidden" name="panelId" value={panel.id} /> : null}
      {panel ? null : (
        <>
          <Field id={`${key}-lab`} label="Lab">
            <Select id={`${key}-lab`} name="labPartnerId" defaultValue="" required>
              <option value="" disabled>
                Choose the lab
              </option>
              {labs?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${key}-code`} label="Code" hint="For example GS5. It cannot be changed later.">
            <Input id={`${key}-code`} name="code" maxLength={20} required />
          </Field>
        </>
      )}
      <Field id={`${key}-name`} label="Name">
        <Input id={`${key}-name`} name="name" maxLength={120} defaultValue={panel?.name} required />
      </Field>
      <Field id={`${key}-price`} label="Price (£)">
        <Input id={`${key}-price`} name="price" inputMode="decimal" defaultValue={panel ? pounds(panel.pricePence) : undefined} required />
      </Field>
      <Field id={`${key}-sex`} label="For">
        <Select id={`${key}-sex`} name="sexRestriction" defaultValue={panel?.sexRestriction ?? ""}>
          <option value="">Any patient</option>
          <option value="F">{SEX_LABELS.F}</option>
          <option value="M">{SEX_LABELS.M}</option>
        </Select>
      </Field>
      <Field id={`${key}-tubes`} label="Tubes" hint="For example 1 purple, 2 gold, 1 grey.">
        <Input id={`${key}-tubes`} name="tubes" maxLength={200} defaultValue={panel?.tubes ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${key}-prep`} label="Preparation shown to the patient">
          <Textarea id={`${key}-prep`} name="preparation" maxLength={1000} defaultValue={panel?.preparation ?? ""} />
        </Field>
      </div>
      <label className="type-body flex items-center gap-2">
        <input type="checkbox" name="fasting" defaultChecked={panel?.fasting ?? false} className="size-4 accent-secondary" />
        Fasting needed
      </label>
      <label className="type-body flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={panel?.active ?? true} className="size-4 accent-secondary" />
        Can be ordered
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <div>
          <Button type="submit" loading={pending}>
            {panel ? "Save panel" : "Add panel"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function RouteFeeForm({ fee }: { fee: RouteFee }) {
  const [state, action, pending] = useActionState(saveRouteFee, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-4" key={state.sentAt ?? fee.route}>
      <input type="hidden" name="route" value={fee.route} />
      <Field id={`fee-${fee.route}`} label={`${ROUTE_LABELS[fee.route]} (£)`}>
        <Input id={`fee-${fee.route}`} name="fee" inputMode="decimal" defaultValue={pounds(fee.feePence)} required className="w-32" />
      </Field>
      <Button type="submit" variant="outline" loading={pending}>
        Save fee
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
