import type { ResultStatus } from "@/components/ui/status-pill";
import type { Database } from "@/lib/database.types";

type ResultFlag = Database["public"]["Enums"]["result_flag"];

/** Maps the lab's flag to the fixed trio shown on screen. */
export function resultStatus(flag: ResultFlag | null): ResultStatus | null {
  if (flag === null) return null;
  if (flag === "normal") return "in_range";
  if (flag === "borderline") return "borderline";
  return "out_of_range";
}

export function isOutOfRange(flag: ResultFlag | null): boolean {
  return resultStatus(flag) === "out_of_range";
}

/** The class for a value that needs attention, as well as its pill. */
export function valueClass(status: ResultStatus | null): string {
  if (status === "out_of_range") return "text-status-danger";
  if (status === "borderline") return "text-status-warning";
  return "";
}
