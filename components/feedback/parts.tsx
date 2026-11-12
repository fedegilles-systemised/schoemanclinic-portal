import { CircleAlert, CircleCheck, CircleMinus, type LucideIcon } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { RATING_LABELS, type Rating } from "@/lib/feedback/constants";

const TONE: Record<Rating, { tone: "success" | "warning" | "danger"; icon: LucideIcon }> = {
  green: { tone: "success", icon: CircleCheck },
  amber: { tone: "warning", icon: CircleMinus },
  red: { tone: "danger", icon: CircleAlert },
};

export function RatingPill({ rating }: { rating: Rating }) {
  return <StatusPill tone={TONE[rating].tone} icon={TONE[rating].icon} label={RATING_LABELS[rating]} />;
}
