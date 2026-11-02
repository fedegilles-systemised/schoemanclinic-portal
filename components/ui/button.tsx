import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "type-button-label inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-none border-2 whitespace-nowrap no-underline transition-colors duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-content hover:border-primary-hover hover:bg-primary-hover",
        secondary:
          "border-secondary bg-secondary text-secondary-content hover:border-secondary-border hover:bg-secondary-border",
        outline:
          "border-primary bg-transparent text-content hover:bg-content hover:text-content-inverse",
        "outline-bronze":
          "border-secondary-border bg-transparent text-secondary hover:border-secondary hover:bg-secondary hover:text-content-inverse",
        ghost:
          "border-transparent bg-transparent text-content tracking-[0.12em] hover:underline",
        destructive:
          "border-status-danger bg-transparent text-status-danger hover:bg-status-danger hover:text-content-inverse",
        link: "border-transparent bg-transparent text-secondary underline underline-offset-4 hover:text-content",
      },
      size: {
        default: "h-control px-5",
        sm: "h-control-sm px-3.5",
        icon: "size-control-sm border-transparent bg-transparent text-content-muted hover:bg-transparent hover:text-content",
      },
    },
    compoundVariants: [
      { variant: "ghost", size: "default", className: "h-auto px-1 py-1" },
      { variant: "ghost", size: "sm", className: "h-auto px-1 py-1" },
      { variant: "link", size: "default", className: "h-auto px-0 py-1" },
      { variant: "link", size: "sm", className: "h-auto px-0 py-1" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner, disables the button and marks it busy. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
