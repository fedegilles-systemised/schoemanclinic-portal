import { cn } from "@/lib/utils";

/** Marks demo or test data. Shown when NEXT_PUBLIC_DEMO=true. */
function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="region"
      aria-label="Demo environment"
      className={cn(
        "type-eyebrow bg-surface-inverse px-4 py-1.5 text-center text-content-inverse",
        className,
      )}
    >
      Demo environment · fictional data
    </div>
  );
}

export { DemoBanner };
