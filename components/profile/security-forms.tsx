"use client";

import { useActionState } from "react";

import { Field } from "@/components/auth/form-parts";
import { PasswordInput } from "@/components/auth/password-input";
import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changePassword,
  requestEmailChange,
  signOutOtherDevices,
  type ProfileFormState,
} from "@/lib/profile/actions";

const initial: ProfileFormState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="current" label="Current password">
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </Field>
      <Field id="next" label="New password">
        <PasswordInput id="next" name="next" autoComplete="new-password" required />
      </Field>
      <Field id="confirm" label="Repeat the new password">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <p className="type-small text-content-muted">
        At least 12 characters, with a lower-case letter, a capital and a number.
      </p>
      <FormMessage state={state} />
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export function ChangeEmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(requestEmailChange, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="type-small text-content-muted">Your sign-in email is {email}.</p>
      <Field id="newEmail" label="New email address">
        <Input id="newEmail" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="emailPassword" label="Current password">
        <PasswordInput id="emailPassword" name="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" variant="outline" loading={pending}>
        Send confirmation link
      </Button>
    </form>
  );
}

export function SignOutOthersForm() {
  const [state, action, pending] = useActionState(signOutOtherDevices, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <FormMessage state={state} />
      <Button type="submit" variant="outline" loading={pending}>
        Sign out other devices
      </Button>
    </form>
  );
}
