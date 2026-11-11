"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";

import { Field } from "@/components/auth/form-parts";
import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { PatientOption } from "@/lib/data/invitations";
import {
  INVITATION_DAYS,
  KIND_LABELS,
  RELATIONSHIP_LABELS,
  RELATIONSHIPS,
  TEAM_ROLE_LABELS,
  TEAM_ROLES,
  type InvitationKind,
} from "@/lib/invitations/constants";
import { sendInvitation, type InvitationFormState } from "@/lib/invitations/actions";

const initial: InvitationFormState = {};

const KIND_HELP: Record<InvitationKind, string> = {
  patient: "Gives a patient access to their own portal.",
  guardian: "Lets someone see, and if you allow it act for, a patient.",
  team: "Gives a colleague access to the clinic portal.",
};

export function InviteSheet({ kinds, patients }: { kinds: InvitationKind[]; patients: PatientOption[] }) {
  const [state, action, pending] = useActionState(sendInvitation, initial);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<InvitationKind>(kinds[0] ?? "patient");
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  // Held here, so the form's reset after sending does not flip the switch back unseen.
  const [canAct, setCanAct] = useState(false);
  const [sendAnyway, setSendAnyway] = useState(false);

  const choosable = kind === "patient" ? patients.filter((patient) => !patient.hasAccount) : patients;
  const aboutPatient = kind === "patient" || kind === "guardian";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <UserPlus aria-hidden />
          Invite someone
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite someone</SheetTitle>
          <SheetDescription>They get an email with a link that works for {INVITATION_DAYS} days.</SheetDescription>
        </SheetHeader>
        <form action={action} className="flex flex-col gap-4 overflow-y-auto px-6 pb-8">
          <Field id="kind" label="Who are you inviting">
            <Select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as InvitationKind)}>
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {KIND_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="type-small -mt-2 text-content-muted">{KIND_HELP[kind]}</p>

          <Field id="invite-email" label="Email address">
            <Input id="invite-email" name="email" type="email" autoComplete="off" required />
          </Field>

          {aboutPatient ? (
            <>
              <input type="hidden" name="patientMode" value={patientMode} />
              <Field id="patient-mode" label={kind === "patient" ? "Which patient" : "Guardian of which patient"}>
                <Select
                  id="patient-mode"
                  value={patientMode}
                  onChange={(event) => setPatientMode(event.target.value as "existing" | "new")}
                >
                  <option value="existing">A patient already in the clinic&apos;s records</option>
                  <option value="new">A new patient</option>
                </Select>
              </Field>
              {patientMode === "existing" ? (
                <Field id="patientId" label="Patient">
                  <Select id="patientId" name="patientId" required defaultValue="">
                    <option value="" disabled>
                      {choosable.length ? "Choose a patient" : "No patients without an account"}
                    </option>
                    {choosable.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} · {patient.clinicRef}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <>
                  <Field id="newFirstName" label="Patient's first name">
                    <Input id="newFirstName" name="newFirstName" maxLength={60} required />
                  </Field>
                  <Field id="newLastName" label="Patient's last name">
                    <Input id="newLastName" name="newLastName" maxLength={60} required />
                  </Field>
                  <Field id="newDob" label="Date of birth">
                    <Input id="newDob" name="newDob" type="date" required />
                  </Field>
                  <p className="type-small text-content-muted">
                    This adds the patient to the clinic&apos;s records with these details. The clinic reference is made for you.
                  </p>
                </>
              )}
            </>
          ) : null}

          {kind === "guardian" ? (
            <>
              <Field id="guardian-name" label="Guardian's name (optional)">
                <Input id="guardian-name" name="fullName" maxLength={120} autoComplete="off" />
              </Field>
              <Field id="relationship" label="Relationship to the patient">
                <Select id="relationship" name="relationship" required defaultValue="">
                  <option value="" disabled>
                    Choose
                  </option>
                  {RELATIONSHIPS.map((item) => (
                    <option key={item} value={item}>
                      {RELATIONSHIP_LABELS[item]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-4 border border-surface-border px-4 py-3">
                <div>
                  <div className="type-card-title">Can act for the patient</div>
                  <div className="type-small text-content-muted">Pay, request repeats and ask the clinic questions.</div>
                </div>
                <Switch checked={canAct} onCheckedChange={setCanAct} aria-label="Can act for the patient" />
                {canAct ? <input type="hidden" name="canAct" value="on" /> : null}
              </div>
            </>
          ) : null}

          {kind === "team" ? (
            <>
              <Field id="team-name" label="Name (optional)">
                <Input id="team-name" name="fullName" maxLength={120} autoComplete="off" />
              </Field>
              <Field id="role" label="Role">
                <Select id="role" name="role" required defaultValue="">
                  <option value="" disabled>
                    Choose a role
                  </option>
                  {TEAM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {TEAM_ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="jobTitle" label="Job title (optional)">
                <Input id="jobTitle" name="jobTitle" maxLength={120} />
              </Field>
            </>
          ) : null}

          {aboutPatient ? (
            <p className="type-small text-content-muted">
              {kind === "guardian"
                ? "To accept, the guardian will be asked for the patient's date of birth."
                : "To accept, the patient will be asked for their date of birth."}
            </p>
          ) : null}
          {kind === "guardian" && canAct ? (
            <p className="type-small text-content-muted">The other PAs will be told that a guardian who can act was invited.</p>
          ) : null}
          {kind === "team" ? (
            <p className="type-small text-content-muted">
              When a doctor or an admin is invited, the other admins and Dr Gina Schoeman are told. Doctors, nurses and health coaches see only the patients whose care team they are on.
            </p>
          ) : null}

          <FormMessage state={state} />
          {state.needsConfirm ? (
            <div className="flex items-center justify-between gap-4 border border-surface-border px-4 py-3">
              <div>
                <div className="type-card-title">Send to this address anyway</div>
                <div className="type-small text-content-muted">Check it with the patient first. Then switch this on and send again.</div>
              </div>
              <Switch checked={sendAnyway} onCheckedChange={setSendAnyway} aria-label="Send to this address anyway" />
              {sendAnyway ? <input type="hidden" name="confirmMismatch" value="on" /> : null}
            </div>
          ) : null}
          <div>
            <Button type="submit" loading={pending}>
              Send invitation
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
