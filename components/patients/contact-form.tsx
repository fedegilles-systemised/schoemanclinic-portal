"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PatientContact } from "@/lib/data/patient-contact";
import { updatePatientContact, type CareTeamFormState } from "@/lib/patients/actions";

const initial: CareTeamFormState = {};

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** For a PA: the patient's date of birth, sex at birth, contact details and postal address, which SignatureRx needs. */
export function PatientContactForm({ patientId, contact }: { patientId: string; contact: PatientContact }) {
  const [state, action, pending] = useActionState(updatePatientContact, initial);
  // A value other than F or M, entered before this form existed, is shown as it is until someone chooses.
  const first = contact.sex.trim().charAt(0).toUpperCase();
  const sexValue = first === "F" ? "F" : first === "M" ? "M" : contact.sex.trim() === "" ? "" : contact.sex;
  const unrecognised = sexValue !== "" && sexValue !== "F" && sexValue !== "M";
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-dob" label="Date of birth">
          <Input id="contact-dob" name="dateOfBirth" type="date" defaultValue={contact.dateOfBirth} min="1900-01-01" required />
        </Field>
        <Field id="contact-sex" label="Sex at birth">
          <Select id="contact-sex" name="sex" defaultValue={sexValue}>
            <option value="">Not recorded</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            {unrecognised ? <option value={contact.sex}>{`Recorded as "${contact.sex}": choose one`}</option> : null}
          </Select>
        </Field>
        <Field id="contact-email" label="Contact email">
          <Input id="contact-email" name="email" type="email" defaultValue={contact.email} maxLength={254} autoComplete="off" />
        </Field>
        <Field id="contact-line1" label="Address, first line">
          <Input id="contact-line1" name="addressLine1" defaultValue={contact.addressLine1} maxLength={200} autoComplete="off" />
        </Field>
        <Field id="contact-line2" label="Address, second line">
          <Input id="contact-line2" name="addressLine2" defaultValue={contact.addressLine2} maxLength={200} autoComplete="off" />
        </Field>
        <Field id="contact-city" label="Town or city">
          <Input id="contact-city" name="city" defaultValue={contact.city} maxLength={100} autoComplete="off" />
        </Field>
        <Field id="contact-postcode" label="Postcode">
          <Input id="contact-postcode" name="postcode" defaultValue={contact.postcode} maxLength={20} autoComplete="off" />
        </Field>
        <Field id="contact-country" label="Country">
          <Input id="contact-country" name="country" defaultValue={contact.country} maxLength={100} autoComplete="off" />
        </Field>
        <Field id="contact-phone" label="Phone number">
          <Input id="contact-phone" name="phone" type="tel" defaultValue={contact.phone} maxLength={40} autoComplete="off" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save details
        </Button>
      </div>
    </form>
  );
}
