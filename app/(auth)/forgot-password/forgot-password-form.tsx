"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { AuthHeading, Field, FormError } from "@/components/auth/form-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your email address and we will send you a link to choose a new password."
      />
      {state.sent ? (
        <Alert variant="info">
          <Check aria-hidden />
          <AlertDescription>
            If that address has an account, we have sent a link to it. The link works once.
          </AlertDescription>
        </Alert>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <Field id="email" label="Email address">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <FormError message={state.error} />
          <Button type="submit" loading={pending}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="type-small">
        <Link href="/login" className="text-secondary underline underline-offset-4 hover:text-content">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
