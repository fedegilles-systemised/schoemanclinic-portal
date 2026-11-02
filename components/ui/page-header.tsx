import * as React from "react";

import { cn } from "@/lib/utils";

type AccentTitleProps = {
  /** Text before the accent word, including any trailing space. */
  title?: string;
  /** One optional italic word or phrase, set in `secondary`. One per title. */
  accent?: string;
  /** Text after the accent word. */
  suffix?: string;
};

function AccentTitle({ title, accent, suffix }: AccentTitleProps) {
  return (
    <>
      {title}
      {accent ? <em className="text-secondary italic">{accent}</em> : null}
      {suffix}
    </>
  );
}

type PageHeaderProps = AccentTitleProps & {
  eyebrow: string;
  description?: string;
  /** Actions on the right. One primary per screen. */
  children?: React.ReactNode;
  className?: string;
};

/** An eyebrow plus the screen's one page title. */
function PageHeader({ eyebrow, title, accent, suffix, description, children, className }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <div className="type-eyebrow text-content-muted">{eyebrow}</div>
        <h1 className="type-page-title mt-1.5">
          <AccentTitle title={title} accent={accent} suffix={suffix} />
        </h1>
        {description ? <p className="type-body mt-2.5 max-w-[62ch] text-content-muted">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

type SectionHeaderProps = AccentTitleProps & {
  /** Right-hand content: a ghost link, chips or a line of context. */
  children?: React.ReactNode;
  className?: string;
  id?: string;
};

/** A section-title heading inside a screen. */
function SectionHeader({ title, accent, suffix, children, className, id }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-4", className)}>
      <h2 id={id} className="type-section-title">
        <AccentTitle title={title} accent={accent} suffix={suffix} />
      </h2>
      {children}
    </div>
  );
}

export { AccentTitle, PageHeader, SectionHeader };
