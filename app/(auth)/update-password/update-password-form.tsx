"use client";

import { useActionState } from "react";

import { AuthHeading, Field, FormError } from "@/components/auth/form-parts";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { updatePassword, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = {};

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);

  return (
    <>
      <AuthHeading title="Choose a new password" />
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Field id="password" label="New password">
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              aria-describedby="password-help"
              autoFocus
            />
          </Field>
          <p id="password-help" className="type-small text-content-muted">
            At least 12 characters, with a lower-case letter, a capital and a number.
          </p>
        </div>
        <FormError message={state.error} />
        <Button type="submit" loading={pending}>
          Save new password
        </Button>
      </form>
    </>
  );
}
