import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "type-body h-control w-full min-w-0 rounded-none border border-surface-border bg-surface-raised px-3.5 text-content transition-colors duration-150 ease-out placeholder:text-content-muted focus:border-secondary-border disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-status-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
