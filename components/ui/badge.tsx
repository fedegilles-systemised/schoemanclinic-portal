import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Counts and neutral tags. For a status, use StatusPill: it carries an icon and a word. */
const badgeVariants = cva(
  "type-pill-label inline-flex min-w-5 items-center justify-center rounded-pill px-1.5 py-1 tabular-nums",
  {
    variants: {
      variant: {
        count: "bg-primary text-primary-content",
        neutral: "bg-surface-sunken text-content-muted",
        outline: "border border-surface-border text-content-muted",
      },
    },
    defaultVariants: { variant: "count" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
