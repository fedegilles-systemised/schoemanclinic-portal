import { Label } from "@/components/ui/label";

/** A label above a control, with an optional hint below. The one form field wrapper; do not make local copies. */
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="type-small text-content-muted">{hint}</p> : null}
    </div>
  );
}

export { Field };
