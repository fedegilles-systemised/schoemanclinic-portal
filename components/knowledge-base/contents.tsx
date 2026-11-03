"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ContentsItem = { id: string; title: string };

/**
 * The section list. On wide screens it is a sidebar that stays in view while the page
 * scrolls; on narrow ones it is a bar fixed to the top with a menu. The current section
 * is marked as the reader scrolls.
 */
export function Contents({ items }: { items: ContentsItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);

    // The last heading that has reached the top of the page. A scroll listener, not an
    // observer: a fast scroll can jump past a heading without it ever being "visible".
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = headings[0]?.id ?? "";
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > 140) break;
        current = heading.id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  const activeTitle = items.find((item) => item.id === activeId)?.title ?? "Sections";

  const links = (onNavigate?: () => void) =>
    items.map((item) => (
      <li key={item.id}>
        <a
          href={`#${item.id}`}
          onClick={onNavigate}
          aria-current={item.id === activeId ? "location" : undefined}
          className={cn(
            "type-table block border-l-2 border-transparent px-3 py-1.5 text-content-muted no-underline",
            item.id === activeId && "border-secondary-border bg-surface-selected text-content",
          )}
        >
          {item.title}
        </a>
      </li>
    ));

  return (
    <>
      <nav aria-label="Contents" className="sticky top-8 hidden max-h-[calc(100dvh-4rem)] self-start overflow-y-auto shell:block">
        <div className="type-eyebrow px-3 pb-3 text-content-muted">Contents</div>
        <ol className="flex flex-col gap-0.5">{links()}</ol>
      </nav>

      <nav aria-label="Contents" className="sticky top-0 z-30 -mx-5 border-b border-surface-border bg-surface px-5 shell:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="type-table flex w-full items-center justify-between gap-3 py-3 text-left"
        >
          <span className="truncate">{activeTitle}</span>
          <span className="type-eyebrow shrink-0 text-content-muted">{open ? "Close" : "Sections"}</span>
        </button>
        {open ? <ol className="flex flex-col gap-0.5 pb-3">{links(() => setOpen(false))}</ol> : null}
      </nav>
    </>
  );
}
