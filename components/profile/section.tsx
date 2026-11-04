import { cn } from "@/lib/utils";

/** A block inside a profile tab: a title, a line of help, then the content. */
export function ProfileSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex max-w-[560px] flex-col gap-4 border-b border-surface-border pb-10 last:border-b-0", className)}>
      <header className="flex flex-col gap-1.5">
        <h2 className="type-card-display">{title}</h2>
        {description ? <p className="type-small text-content-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Label and value pairs for read-only details. */
export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 phone:grid-cols-[160px_minmax(0,1fr)]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="type-eyebrow pt-0.5 text-content-muted">{item.label}</dt>
          <dd className="type-body">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
