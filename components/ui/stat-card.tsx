import * as React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** One line of context. */
  context?: React.ReactNode;
  /** Colours the number status-danger. Only when it counts something needing action. */
  urgent?: boolean;
  /** Each stat links to the list it counts, once that list exists. */
  href?: string;
  /** Optional status pill or sparkline. */
  children?: React.ReactNode;
  className?: string;
};

function StatCard({ label, value, unit, context, urgent, href, children, className }: StatCardProps) {
  const body = (
    <>
      <div className="type-eyebrow text-content-muted">{label}</div>
      <div>
        <span className={cn("type-big-number", urgent && "text-status-danger")}>{value}</span>
        {unit ? <span className="type-small ml-1 text-content-muted">{unit}</span> : null}
      </div>
      {context ? <div className="type-small text-content-muted">{context}</div> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex min-w-0 flex-col gap-3 rounded-card border border-surface-border bg-surface-raised p-6 text-content no-underline transition-colors duration-150 ease-out hover:border-secondary-border",
          className,
        )}
      >
        {body}
      </Link>
    );
  }
  return <Card className={className}>{body}</Card>;
}

export { StatCard };
