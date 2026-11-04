"use client";

import { useActionState } from "react";

import { Field, FormError } from "@/components/auth/form-parts";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptInvitationWhileSignedIn,
  createAccountFromInvitation,
  signInToAcceptInvitation,
  signOutForInvitation,
  type AcceptFormState,
} from "@/lib/invitations/accept-actions";

const initial: AcceptFormState = {};

type DobAsk = "patient" | "guardian" | null;

/** The date of birth that proves the link reached the right person. */
function DobField({ ask }: { ask: DobAsk }) {
  if (!ask) return null;
  return (
    <Field id="dob" label={ask === "guardian" ? "The patient's date of birth" : "Your date of birth"}>
      <Input id="dob" name="dob" type="date" autoComplete={ask === "patient" ? "bday" : "off"} required />
      <p className="type-small mt-1 text-content-muted">This checks that the invitation reached the right person.</p>
    </Field>
  );
}

export function CreateAccountForm({ email, defaultName, ask }: { email: string; defaultName: string; ask: DobAsk }) {
  const [state, action, pending] = useActionState(createAccountFromInvitation, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="invite-email" label="Email address">
        <Input id="invite-email" value={email} readOnly disabled />
      </Field>
      <Field id="fullName" label="Your name">
        <Input id="fullName" name="fullName" defaultValue={defaultName} autoComplete="name" maxLength={120} required />
      </Field>
      <Field id="password" label="Choose a password">
        <PasswordInput id="password" name="password" autoComplete="new-password" required />
      </Field>
      <Field id="confirm" label="Repeat the password">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <DobField ask={ask} />
      <p className="type-small text-content-muted">At least 12 characters, with a lower-case letter, a capital and a number.</p>
      <FormError message={state.error} />
      <Button type="submit" loading={pending}>
        Create my account
      </Button>
    </form>
  );
}

export function SignInToAcceptForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(signInToAcceptInvitation, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="invite-email" label="Email address">
        <Input id="invite-email" value={email} readOnly disabled />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function ConfirmAcceptForm({ label, ask }: { label: string; ask: DobAsk }) {
  const [state, action, pending] = useActionState(acceptInvitationWhileSignedIn, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <DobField ask={ask} />
      <FormError message={state.error} />
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </form>
  );
}

export function SignOutForm() {
  return (
    <form action={signOutForInvitation}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
