import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

/** Errors sit in an alert block above the submit button, never in a toast. */
function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="danger">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** A visible label above its control. */
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function AuthHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      {eyebrow ? <p className="type-eyebrow text-content-muted">{eyebrow}</p> : null}
      <h1 className="type-page-title">{title}</h1>
      {description ? <p className="type-small text-content-muted">{description}</p> : null}
    </header>
  );
}

export { AuthHeading, Field, FormError };
