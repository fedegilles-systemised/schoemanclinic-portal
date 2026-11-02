import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the design system's custom scales, so later classes win.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { radius: ["pill", "card", "round"] },
    classGroups: {
      "font-size": [
        {
          type: [
            "hero-title",
            "page-title",
            "section-title",
            "card-display",
            "card-title",
            "eyebrow",
            "body",
            "small",
            "table",
            "value",
            "big-number",
            "button-label",
            "pill-label",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
