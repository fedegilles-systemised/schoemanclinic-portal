import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ProfileFormState } from "@/lib/profile/actions";

/** The outcome of a profile form: an error, or a confirmation. Never a toast. */
export function FormMessage({ state }: { state: ProfileFormState }) {
  if (state.error) {
    return (
      <Alert variant="danger">
        <CircleAlert aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.saved) {
    return (
      <Alert variant="success">
        <CircleCheck aria-hidden />
        <AlertDescription>{state.saved}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
