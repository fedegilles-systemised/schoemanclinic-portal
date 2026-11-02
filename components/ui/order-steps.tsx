import { cn } from "@/lib/utils";

type OrderStepsProps = {
  steps: string[];
  /** Index of the last step that is done. Use -1 when none is. */
  doneThrough: number;
  className?: string;
};

/** A thin progress line: done in secondary, the current step half filled, ahead in surface-border. */
function OrderSteps({ steps, doneThrough, className }: OrderStepsProps) {
  return (
    <ol data-slot="order-steps" className={cn("my-1 flex list-none gap-1", className)}>
      {steps.map((step, index) => {
        const done = index <= doneThrough;
        const current = index === doneThrough + 1;
        return (
          <li
            key={step}
            aria-current={current ? "step" : undefined}
            className={cn("flex flex-1 flex-col gap-2 text-xs", done || current ? "text-content" : "text-content-muted")}
          >
            <span className="relative block h-0.5 bg-surface-border">
              {done ? <span className="absolute inset-0 bg-secondary" /> : null}
              {current ? <span className="absolute inset-y-0 left-0 w-1/2 bg-secondary" /> : null}
            </span>
            <span>
              {step}
              <span className="sr-only">{done ? " (done)" : current ? " (current step)" : " (not started)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { OrderSteps };
