import { Label } from "@/components/ui/label";

/** A label above a control, with an optional hint below and an optional required mark. The one form field wrapper; do not make local copies. */
function Field({ id, label, hint, required = false, children }: { id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            <span aria-hidden> *</span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="type-small text-content-muted">{hint}</p> : null}
    </div>
  );
}

export { Field };
