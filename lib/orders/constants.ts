import type { Database } from "@/lib/database.types";

export type OrderRoute = Database["public"]["Enums"]["order_route"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ORDER_ROUTES: readonly OrderRoute[] = ["tdl_site", "tdl_kit"];

export const ROUTE_LABELS: Record<OrderRoute, string> = {
  tdl_site: "At a TDL collection point",
  tdl_kit: "TDL home kit",
};

export const ROUTE_HELP: Record<OrderRoute, string> = {
  tdl_site: "The sample is taken by a phlebotomist at a TDL site. Bring the barcode below.",
  tdl_kit: "A kit is sent to you. The sample is taken at home, or by a visiting nurse.",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  sent_to_patient: "Awaiting payment",
  paid: "Paid",
  sample_taken: "Sample taken",
  results_in: "Results in",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
};

/** The orders still moving, as opposed to finished or cancelled ones. */
export const OPEN_STATUSES: readonly OrderStatus[] = ["sent_to_patient", "paid", "sample_taken"];

export const SEX_LABELS = { F: "Female patients only", M: "Male patients only" } as const;
