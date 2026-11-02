import * as React from "react";

import { cn } from "@/lib/utils";

/** One thing: an appointment, an order, a medication. Do not nest cards. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border border-surface-border bg-surface-raised p-6 text-content",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1", className)} {...props} />;
}

function CardEyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-eyebrow" className={cn("type-eyebrow text-content-muted", className)} {...props} />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("type-card-title", className)} {...props} />;
}

/** The name of a product of care, such as an order or a medication. */
function CardDisplayTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-display-title" className={cn("type-card-display", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("type-small text-content-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-3", className)} {...props} />;
}

/** A row of meta items in `small`, each with a 15px icon. */
function CardMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-meta"
      className={cn(
        "type-small flex flex-wrap gap-x-4.5 gap-y-1.5 text-content-muted [&_svg]:size-[15px] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5",
        className,
      )}
      {...props}
    />
  );
}

/** Actions sit at the bottom, left aligned, in `sm` buttons. */
function CardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-actions" className={cn("mt-auto flex flex-wrap gap-2 pt-2", className)} {...props} />
  );
}

export {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardDisplayTitle,
  CardEyebrow,
  CardHeader,
  CardMeta,
  CardTitle,
};
