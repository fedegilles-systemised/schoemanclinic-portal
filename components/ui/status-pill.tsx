import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const statusPillVariants = cva(
  "type-pill-label inline-flex h-pill items-center gap-1.5 rounded-pill px-2 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        success: "bg-status-success-bg text-status-success",
        warning: "bg-status-warning-bg text-status-warning",
        danger: "bg-status-danger-bg text-status-danger",
        info: "bg-status-info-bg text-status-info",
        dark: "bg-content text-content-inverse",
        neutral: "bg-surface-sunken text-content-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type StatusPillProps = Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof statusPillVariants> & {
    /** The word. Status is never colour alone. */
    label: string;
    icon: LucideIcon;
  };

/** Colour, icon and word together. Not a button. */
function StatusPill({ className, tone, label, icon: Icon, ...props }: StatusPillProps) {
  return (
    <span data-slot="status-pill" className={cn(statusPillVariants({ tone }), className)} {...props}>
      <Icon aria-hidden />
      {label}
    </span>
  );
}

export type ResultStatus = "in_range" | "borderline" | "out_of_range";

const RESULT_STATUS = {
  in_range: { tone: "success", label: "In range", icon: Check },
  borderline: { tone: "warning", label: "Borderline", icon: Minus },
  out_of_range: { tone: "danger", label: "Out of range", icon: TriangleAlert },
} as const;

/** The fixed trio for results: IN RANGE, BORDERLINE, OUT OF RANGE. */
function ResultStatusPill({ status, className }: { status: ResultStatus; className?: string }) {
  return <StatusPill {...RESULT_STATUS[status]} className={className} />;
}

export { ResultStatusPill, StatusPill, statusPillVariants };
