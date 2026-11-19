"use client";

import { useActionState, useTransition } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MyRegistration } from "@/lib/data/registration";
import { formatDate } from "@/lib/format";
import { submitRegistration, type RegistrationFormState } from "@/lib/registration/actions";
import { DEFAULT_COUNTRY, PRIVACY_NOTICE_URL, TERMS_URL, TITLES } from "@/lib/registration/constants";

const initial: RegistrationFormState = {};
const checkbox = "mt-1 size-4 shrink-0 accent-secondary";

/**
 * The clinic's registration form, for a new patient to complete once. It is sent from the form's own values, not
 * as a form action, so that nothing typed (and not the chosen file) is lost if something needs correcting.
 */
export function RegistrationForm({ me }: { me: MyRegistration }) {
  const [state, dispatch, pending] = useActionState(submitRegistration, initial);
  const [, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
      className="flex flex-col gap-10"
      noValidate
    >
      <section aria-labelledby="personal" className="flex flex-col gap-4">
        <SectionHeader id="personal" title="Personal " accent="details" />
        <dl className="type-body grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="type-small text-content-muted">Name</dt>
            <dd>
              {me.firstName} {me.lastName}
            </dd>
          </div>
          <div>
            <dt className="type-small text-content-muted">Date of birth</dt>
            <dd>{formatDate(me.dateOfBirth)}</dd>
          </div>
          {me.email ? (
            <div>
              <dt className="type-small text-content-muted">Email</dt>
              <dd>{me.email}</dd>
            </div>
          ) : null}
        </dl>
        <p className="type-small text-content-muted">Questions marked * need an answer.</p>
        <p className="type-small text-content-muted">These come from your invitation. If anything is wrong, please tell the clinic after you finish.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="title" label="Title">
            <Select id="title" name="title" defaultValue="">
              <option value="">Choose a title</option>
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="gender" label="Gender">
            <Input id="gender" name="gender" defaultValue={me.gender ?? ""} maxLength={100} autoComplete="off" />
          </Field>
          <Field id="phone" label="Phone number">
            <Input id="phone" name="phone" type="tel" defaultValue={me.phone ?? ""} maxLength={20} autoComplete="tel" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="addressLine1" label="Address">
            <Input id="addressLine1" name="addressLine1" defaultValue={me.addressLine1 ?? ""} maxLength={200} autoComplete="address-line1" />
          </Field>
          <Field id="addressLine2" label="Address, second line">
            <Input id="addressLine2" name="addressLine2" defaultValue={me.addressLine2 ?? ""} maxLength={200} autoComplete="address-line2" />
          </Field>
          <Field id="town" label="Town or city">
            <Input id="town" name="town" defaultValue={me.city ?? ""} maxLength={120} autoComplete="address-level2" />
          </Field>
          <Field id="postcode" label="Postcode">
            <Input id="postcode" name="postcode" defaultValue={me.postcode ?? ""} maxLength={20} autoComplete="postal-code" />
          </Field>
          <Field id="country" label="Country">
            <Input id="country" name="country" defaultValue={me.country ?? DEFAULT_COUNTRY} maxLength={80} autoComplete="country-name" />
          </Field>
        </div>
      </section>

      <section aria-labelledby="contacts" className="flex flex-col gap-4">
        <SectionHeader id="contacts" title="Next of kin and " accent="GP" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required id="nextOfKinName" label="Next of kin, name">
            <Input id="nextOfKinName" name="nextOfKinName" required maxLength={120} />
          </Field>
          <Field required id="nextOfKinRelationship" label="Next of kin, relationship to you">
            <Input id="nextOfKinRelationship" name="nextOfKinRelationship" required maxLength={80} />
          </Field>
          <Field required id="nextOfKinPhone" label="Next of kin, telephone">
            <Input id="nextOfKinPhone" name="nextOfKinPhone" type="tel" required maxLength={20} />
          </Field>
          <Field required id="gpName" label="GP name">
            <Input id="gpName" name="gpName" required maxLength={120} />
          </Field>
        </div>
        <Field required id="gpPractice" label="GP practice name and address">
          <Textarea id="gpPractice" name="gpPractice" required maxLength={400} rows={3} />
        </Field>
      </section>

      <section aria-labelledby="about" className="flex flex-col gap-4">
        <SectionHeader id="about" title="About " accent="you" />
        <fieldset className="flex flex-col gap-2">
          <legend className="type-small mb-1 text-content-muted">
            Sex at birth
            <span aria-hidden> *</span>
            <span className="sr-only"> (required)</span>
          </legend>
          <label className="type-body flex items-center gap-2">
            <input type="radio" name="sex" value="M" required defaultChecked={me.sex === "M"} className="size-4 accent-secondary" />
            Male
          </label>
          <label className="type-body flex items-center gap-2">
            <input type="radio" name="sex" value="F" defaultChecked={me.sex === "F"} className="size-4 accent-secondary" />
            Female
          </label>
        </fieldset>
        <Field required id="occupation" label="Occupation">
          <Input id="occupation" name="occupation" required maxLength={120} autoComplete="organization-title" />
        </Field>
      </section>

      <section aria-labelledby="goals" className="flex flex-col gap-4">
        <SectionHeader id="goals" title="Main concerns and " accent="health goals" />
        <Field required id="mainReason" label="What is the main reason for your visit today?">
          <Textarea id="mainReason" name="mainReason" required maxLength={2000} rows={4} />
        </Field>
        <Field required id="concernDuration" label="How long have you had this concern?">
          <Input id="concernDuration" name="concernDuration" required maxLength={500} />
        </Field>
        <Field required id="alreadyTried" label="What have you already tried (treatments, diets, supplements, practitioners)?">
          <Textarea id="alreadyTried" name="alreadyTried" required maxLength={2000} rows={4} />
        </Field>
        <Field required id="healthGoals" label="What are your top three health goals for the next 12 months?">
          <Textarea id="healthGoals" name="healthGoals" required maxLength={2000} rows={4} />
        </Field>
      </section>

      <section aria-labelledby="identity" className="flex flex-col gap-4">
        <SectionHeader id="identity" title="Identity " accent="verification" />
        <Field
          required
          id="identity-file"
          label="Photo ID (passport or driving licence)"
          hint="Please upload a copy so we can verify your identity and protect your records. A PDF, JPEG or PNG up to 10 MB. Only the clinic's reception and administration team can open it."
        >
          <Input id="identity-file" name="identity" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required />
        </Field>
      </section>

      <section aria-labelledby="consent" className="flex flex-col gap-4">
        <SectionHeader id="consent" title="Your " accent="consent" />
        <p className="type-body">
          Please read the{" "}
          <a href={PRIVACY_NOTICE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Privacy Notice
          </a>{" "}
          and the{" "}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Terms of Treatment and Fees
          </a>{" "}
          before you continue. Both open in a new tab.
        </p>
        <label className="type-body flex items-start gap-2">
          <input type="checkbox" name="agreed" required className={checkbox} />I confirm my details are accurate and I agree to the Privacy Notice and the Terms of Treatment and Fees.
        </label>
        <p className="type-small text-content-muted">
          Staying in touch. We will always email you about your care: appointments, blood test instructions, results and consultation letters. We would also like you to hear from the doctors
          directly, about what they are researching, new innovations, what is changing in functional medicine, and what it could mean for your health. You can opt out of these at any time, and we never
          share your details with anyone.
        </p>
        <label className="type-body flex items-start gap-2">
          <input type="checkbox" name="newsOptOut" className={checkbox} />I would prefer not to receive news and insights from the doctors.
        </label>
        <p className="type-small text-content-muted">In addition to email, we can send you WhatsApp messages relating to your care. We will not use WhatsApp for any other purpose.</p>
        <label className="type-body flex items-start gap-2">
          <input type="checkbox" name="whatsapp" className={checkbox} />Yes, I consent to receiving WhatsApp messages about my care.
        </label>
      </section>

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div>
          <Button type="submit" loading={pending}>
            Submit registration
          </Button>
        </div>
      </div>
    </form>
  );
}
