import { cn } from "@/lib/utils";

/** "The" in eyebrow style above "Schoeman Clinic" in display. No logo file yet. */
function Wordmark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <div data-slot="wordmark" className={cn(inverse ? "text-content-inverse" : "text-content", className)}>
      <div className={cn("type-eyebrow", !inverse && "text-content-muted")}>The</div>
      <div className="mt-1 font-display text-[26px] leading-[1.05] font-light tracking-[-0.01em]">Schoeman Clinic</div>
    </div>
  );
}

export { Wordmark };
