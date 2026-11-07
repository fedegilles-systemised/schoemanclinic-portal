import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** The anchor for a heading, shared by the contents list and the headings themselves. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function plainText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  return "";
}

const components: Components = {
  h2: ({ children }) => (
    <h2 id={slugify(plainText(children))} className="type-section-title mt-16 mb-4 scroll-mt-20 first:mt-0 shell:scroll-mt-8">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="type-card-display mt-10 mb-3">{children}</h3>,
  p: ({ children }) => <p className="type-body mt-3">{children}</p>,
  ul: ({ children }) => <ul className="type-body mt-3 list-disc space-y-1.5 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="type-body mt-3 list-decimal space-y-1.5 pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 mb-6 border-l-2 border-secondary-border pl-4 text-content-muted [&_p]:mt-1">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-secondary underline underline-offset-2">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mt-5 overflow-x-auto border border-surface-border">
      <table className="type-table w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="type-eyebrow border-b border-surface-border bg-surface-sunken px-3 py-2.5 align-bottom text-content-muted">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-surface-border px-3 py-2.5 align-top">{children}</td>,
};

/** Renders the knowledge base's Markdown with the design system's type and table styles. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn(className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
