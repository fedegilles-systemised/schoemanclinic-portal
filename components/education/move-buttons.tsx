import { ChevronDown, ChevronUp } from "lucide-react";

import { moveItem } from "@/lib/education/actions";

/** Up and down buttons for a section or a lesson in the course outline. */
export function MoveButtons({ courseId, id, kind, label, first, last }: { courseId: string; id: string; kind: "section" | "lesson"; label: string; first: boolean; last: boolean }) {
  const button = (direction: "up" | "down", disabled: boolean) => (
    <form action={moveItem}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${label} ${direction}`}
        title={direction === "up" ? "Move up" : "Move down"}
        className="flex size-control-sm items-center justify-center text-content-muted hover:bg-surface-selected hover:text-content disabled:pointer-events-none disabled:opacity-30"
      >
        {direction === "up" ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
      </button>
    </form>
  );
  return (
    <div className="flex items-center">
      {button("up", first)}
      {button("down", last)}
    </div>
  );
}
