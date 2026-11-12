"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

import { FormMessage } from "@/components/profile/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestRepeat, type PrescriptionFormState } from "@/lib/prescriptions/actions";
import { isWeightLossName, MAX_REQUEST_ITEMS } from "@/lib/prescriptions/constants";

type Medicine = { id: string; name: string };
type ListMedicine = { id: string; name: string; weightLoss: boolean };
type Line = { key: number; choice: string; other: string; months: "1" | "2" };
type YesNo = "" | "yes" | "no";

const initial: PrescriptionFormState = {};

function YesNoField({ name, legend, value, onChange }: { name: string; legend: string; value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-body mb-1 font-medium">{legend}</legend>
      <div className="flex gap-6">
        {(["yes", "no"] as const).map((option) => (
          <label key={option} className="type-body flex items-center gap-2">
            <input
              type="radio"
              name={`${name}-choice`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="size-4 accent-secondary"
            />
            {option === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The repeat prescription request, replacing the clinic's Typeform: medicines (up to ten, each for
 * one or two months), the appointment question, the weight-loss questions when they apply, a
 * review, then payment. The server and the database check everything again.
 */
export function RepeatRequestForm({
  patientId,
  medicines,
  list,
  hasUpcomingAppointment,
  feeLabel,
  paysOnline,
}: {
  patientId: string;
  medicines: Medicine[];
  list: ListMedicine[];
  hasUpcomingAppointment: boolean;
  feeLabel: string;
  paysOnline: boolean;
}) {
  const [state, action, pending] = useActionState(requestRepeat, initial);
  const [lines, setLines] = useState<Line[]>([{ key: 1, choice: "", other: "", months: "1" }]);
  const [nextKey, setNextKey] = useState(2);
  const [appointment, setAppointment] = useState<YesNo>(hasUpcomingAppointment ? "yes" : "");
  const [wantsAppointment, setWantsAppointment] = useState<YesNo>("");
  const [losing, setLosing] = useState<YesNo>("");
  const [weightLost, setWeightLost] = useState("");
  const [sideEffects, setSideEffects] = useState<YesNo>("");
  const [sideEffectsText, setSideEffectsText] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const weightLossNames = useMemo(() => list.filter((m) => m.weightLoss).map((m) => m.name), [list]);
  const medicineName = (line: Line): string => {
    if (line.choice === "other") return line.other.trim();
    const [kind, id] = line.choice.split(":");
    if (kind === "med") return medicines.find((m) => m.id === id)?.name ?? "";
    if (kind === "list") return list.find((m) => m.id === id)?.name ?? "";
    return "";
  };
  const isWeightLoss = (line: Line): boolean => {
    const [kind, id] = line.choice.split(":");
    if (kind === "list") return list.find((m) => m.id === id)?.weightLoss ?? false;
    const name = medicineName(line);
    return name !== "" && isWeightLossName(name, weightLossNames);
  };
  const needsWeightQuestions = lines.some(isWeightLoss);
  const chosen = new Set(lines.map((l) => l.choice).filter((c) => c !== "" && c !== "other"));

  const items = lines.map((line) => {
    const months = Number(line.months);
    const [kind, id] = line.choice.split(":");
    if (kind === "med") return { medication_id: id, supply_months: months };
    if (kind === "list") return { medicine_id: id, supply_months: months };
    return { other_name: line.other.trim(), supply_months: months };
  });

  function update(key: number, change: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  function check(): string | null {
    if (lines.some((l) => l.choice === "")) return "Choose a medicine on every line, or remove the empty line.";
    if (lines.some((l) => l.choice === "other" && l.other.trim() === "")) return "Type the name of each medicine that is not listed.";
    if (appointment === "") return "Say whether you have a future appointment booked.";
    if (needsWeightQuestions && (losing === "" || sideEffects === "")) return "Answer the weight-loss questions.";
    if (needsWeightQuestions && sideEffects === "yes" && sideEffectsText.trim() === "") return "Describe the side effects.";
    return null;
  }

  const hidden = (
    <>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="hasFutureAppointment" value={appointment} />
      <input type="hidden" name="wantsAppointment" value={appointment === "no" ? wantsAppointment : ""} />
      <input type="hidden" name="stillLosingWeight" value={needsWeightQuestions ? losing : ""} />
      <input type="hidden" name="weightLost" value={needsWeightQuestions && losing === "yes" ? weightLost : ""} />
      <input type="hidden" name="hasSideEffects" value={needsWeightQuestions ? sideEffects : ""} />
      <input type="hidden" name="sideEffects" value={needsWeightQuestions && sideEffects === "yes" ? sideEffectsText : ""} />
      <input type="hidden" name="note" value={note} />
    </>
  );

  if (reviewing) {
    return (
      <form action={action} className="flex flex-col gap-6">
        {hidden}
        <div className="flex flex-col gap-2">
          <h2 className="type-h3">Please check your request</h2>
          <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
            {lines.map((line) => (
              <li key={line.key} className="type-body flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>{medicineName(line)}</span>
                <span className="text-content-muted">{line.months === "1" ? "1 month" : "2 months"}</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="type-body grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-content-muted">Future appointment booked</dt>
          <dd>{appointment === "yes" ? "Yes" : `No${wantsAppointment === "yes" ? ", and I would like to book one" : ""}`}</dd>
          {needsWeightQuestions ? (
            <>
              <dt className="text-content-muted">Still losing weight</dt>
              <dd>{losing === "yes" ? `Yes${weightLost.trim() ? `, ${weightLost.trim()} in the last month` : ""}` : "No"}</dd>
              <dt className="text-content-muted">Side effects</dt>
              <dd className="whitespace-pre-wrap">{sideEffects === "yes" ? sideEffectsText.trim() : "None"}</dd>
            </>
          ) : null}
          {note.trim() ? (
            <>
              <dt className="text-content-muted">Note to the clinic</dt>
              <dd className="whitespace-pre-wrap">{note.trim()}</dd>
            </>
          ) : null}
        </dl>
        <Alert variant="info">
          <AlertDescription>
            {paysOnline
              ? `Dr Gina Schoeman reviews every request. There is an administration fee of ${feeLabel}, paid securely on the next page.`
              : `Dr Gina Schoeman reviews every request. There is an administration fee of ${feeLabel}; the clinic will contact you about payment.`}
          </AlertDescription>
        </Alert>
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>
            {paysOnline ? `Pay ${feeLabel} and send` : "Send request"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={pending}>
            Change my answers
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="medicines-heading" className="flex flex-col gap-4">
        <h2 id="medicines-heading" className="type-h3">
          Medicines
        </h2>
        <p className="type-body text-content-muted">Choose up to ten. If yours is not listed, choose &quot;Not listed&quot; and type it in.</p>
        <ol className="flex flex-col gap-4">
          {lines.map((line, index) => (
            <li key={line.key} className="grid gap-3 border border-surface-border p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`medicine-${line.key}`}>Medicine {index + 1}</Label>
                <Select id={`medicine-${line.key}`} value={line.choice} onChange={(e) => update(line.key, { choice: e.target.value })}>
                  <option value="">Choose a medicine</option>
                  {medicines.length > 0 ? (
                    <optgroup label="Your current medicines">
                      {medicines.map((m) => (
                        <option key={m.id} value={`med:${m.id}`} disabled={chosen.has(`med:${m.id}`) && line.choice !== `med:${m.id}`}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="The clinic's list">
                    {list.map((m) => (
                      <option key={m.id} value={`list:${m.id}`} disabled={chosen.has(`list:${m.id}`) && line.choice !== `list:${m.id}`}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="other">Not listed: I will type it in</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`months-${line.key}`}>Supply</Label>
                <Select id={`months-${line.key}`} value={line.months} onChange={(e) => update(line.key, { months: e.target.value === "2" ? "2" : "1" })}>
                  <option value="1">1 month</option>
                  <option value="2">2 months</option>
                </Select>
              </div>
              <div>
                {lines.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}>
                    <X aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </div>
              {line.choice === "other" ? (
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <Label htmlFor={`other-${line.key}`}>Name, strength and form</Label>
                  <Input id={`other-${line.key}`} value={line.other} maxLength={200} onChange={(e) => update(line.key, { other: e.target.value })} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        {lines.length < MAX_REQUEST_ITEMS ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLines((current) => [...current, { key: nextKey, choice: "", other: "", months: "1" }]);
                setNextKey((k) => k + 1);
              }}
            >
              <Plus aria-hidden />
              Add another medicine
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="appointment-heading" className="flex flex-col gap-4">
        <h2 id="appointment-heading" className="type-h3">
          Your next appointment
        </h2>
        <p className="type-body text-content-muted">
          To repeat a prescription you need a future appointment booked. It helps us decide how long to prescribe for.
          {hasUpcomingAppointment ? " We can see one booked in your portal." : ""}
        </p>
        <YesNoField name="appointment" legend="Do you have a future appointment booked with us?" value={appointment} onChange={setAppointment} />
        {appointment === "no" ? (
          <>
            <YesNoField name="wants" legend="Would you like to book one now?" value={wantsAppointment} onChange={setWantsAppointment} />
            {wantsAppointment === "yes" ? (
              <p className="type-body">
                You can <Link href="/portal/appointments">book an appointment</Link> once you have sent this request.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {needsWeightQuestions ? (
        <section aria-labelledby="weight-heading" className="flex flex-col gap-4">
          <h2 id="weight-heading" className="type-h3">
            Weight-loss medicine
          </h2>
          <p className="type-body text-content-muted">You have asked for a weight-loss medicine, so we need a few more answers.</p>
          <YesNoField name="losing" legend="Are you still losing weight?" value={losing} onChange={setLosing} />
          {losing === "yes" ? (
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="weight-lost">How much have you lost in the last month?</Label>
              <Input id="weight-lost" value={weightLost} maxLength={200} onChange={(e) => setWeightLost(e.target.value)} placeholder="For example, 2 kg" />
            </div>
          ) : null}
          <YesNoField name="side-effects" legend="Are you having any side effects?" value={sideEffects} onChange={setSideEffects} />
          {sideEffects === "yes" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="side-effects-text">Please describe them</Label>
              <Textarea id="side-effects-text" value={sideEffectsText} maxLength={2000} onChange={(e) => setSideEffectsText(e.target.value)} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="note-heading" className="flex flex-col gap-1.5">
        <h2 id="note-heading" className="type-h3 mb-2">
          Anything else
        </h2>
        <Label htmlFor="request-note">A note for the clinic (optional)</Label>
        <Textarea id="request-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </section>

      {problem ? (
        <Alert variant="danger">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button
          type="button"
          onClick={() => {
            const issue = check();
            setProblem(issue);
            if (!issue) setReviewing(true);
          }}
        >
          Review request
        </Button>
      </div>
    </div>
  );
}
