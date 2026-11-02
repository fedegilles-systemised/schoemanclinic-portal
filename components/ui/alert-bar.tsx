import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const alertBarVariants = cva(
  "flex flex-wrap items-center gap-3.5 border border-l-3 px-4.5 py-3.5 text-content [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        warning: "border-status-warning bg-status-warning-bg [&>svg]:text-status-warning",
        danger: "border-status-danger bg-status-danger-bg [&>svg]:text-status-danger",
        info: "border-status-info bg-status-info-bg [&>svg]:text-status-info",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

type AlertBarProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof alertBarVariants> & {
    icon: LucideIcon;
    /** A short bold lead. */
    lead: string;
    /** One line of text. */
    children: React.ReactNode;
    /** At most one action button. */
    action?: React.ReactNode;
  };

/** Flags something to act on. Do not stack more than two, or use for success. */
function AlertBar({ className, tone, icon: Icon, lead, children, action, ...props }: AlertBarProps) {
  return (
    <div data-slot="alert-bar" role="status" className={cn(alertBarVariants({ tone }), className)} {...props}>
      <Icon aria-hidden />
      <p className="type-table min-w-50 flex-1">
        <b className="font-semibold">{lead}</b> {children}
      </p>
      {action}
    </div>
  );
}

export { AlertBar, alertBarVariants };
