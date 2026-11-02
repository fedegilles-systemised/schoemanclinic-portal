import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "type-body min-h-30 w-full resize-y rounded-none border border-surface-border bg-surface-raised px-3.5 py-3 text-content transition-colors duration-150 ease-out placeholder:text-content-muted focus:border-secondary-border disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-status-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
