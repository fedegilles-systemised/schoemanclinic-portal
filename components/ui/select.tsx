import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** A native select, styled like Input: square, hairline, one chevron. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "type-body h-control w-full min-w-0 appearance-none rounded-none border border-surface-border bg-surface-raised pr-10 pl-3.5 text-content transition-colors duration-150 ease-out focus:border-secondary-border disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-status-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-content-muted" />
    </div>
  );
}

export { Select };
