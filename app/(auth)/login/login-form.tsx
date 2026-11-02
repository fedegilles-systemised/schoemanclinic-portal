"use client";

import { useActionState } from "react";
import Link from "next/link";

import { AuthHeading, Field, FormError } from "@/components/auth/form-parts";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = {};

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <>
      <AuthHeading title="Sign in" description="Accounts are by invitation from the clinic." />
      <form action={action} className="flex flex-col gap-4">
        <Field id="email" label="Email address">
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} key={state.email} required autoFocus />
        </Field>
        <Field id="password" label="Password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
        <FormError message={state.error ?? initialError} />
        <Button type="submit" loading={pending}>
          Sign in
        </Button>
      </form>
      <p className="type-small">
        <Link href="/forgot-password" className="text-secondary underline underline-offset-4 hover:text-content">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
