import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** A form-level message block, used for errors above a submit button. */
const alertVariants = cva("type-small flex items-start gap-2.5 rounded-none border px-3.5 py-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      danger: "border-status-danger bg-status-danger-bg text-status-danger",
      warning: "border-status-warning bg-status-warning-bg text-status-warning",
      info: "border-status-info bg-status-info-bg text-status-info",
      success: "border-status-success bg-status-success-bg text-status-success",
    },
  },
  defaultVariants: { variant: "info" },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-semibold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={className} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
