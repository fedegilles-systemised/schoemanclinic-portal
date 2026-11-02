import * as React from "react";

import { cn } from "@/lib/utils";

/** A dashed box with one line saying what will appear. */
function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn("type-table border border-dashed border-surface-border p-8 text-center text-content-muted", className)}
      {...props}
    />
  );
}

export { EmptyState };
