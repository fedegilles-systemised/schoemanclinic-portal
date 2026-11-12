import type { Database } from "@/lib/database.types";

export type RequestStatus = Database["public"]["Enums"]["request_status"];

/** The fee in pence. The database sets the same default (repeat_requests.fee_pence). */
export const REPEAT_FEE_PENCE = 3000;
export const MAX_REQUEST_ITEMS = 10;
/** Patients are reminded, on the home screen and by email, this many days before a supply runs out. */
export const RUN_OUT_WARNING_DAYS = 21;
/** Who hears that a repeat has been paid for, when PRESCRIPTIONS_ALERT_TO is not set. */
export const PRESCRIPTIONS_ALERT_TO_DEFAULT = "info@theschoemanclinic.com";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  requested: "With the clinic",
  approved: "Approved",
  sent_to_pharmacy: "Sent to the pharmacy",
  declined: "Declined",
};

/** Where a request stands, from the patient's side, including payment and withdrawal. */
export type RequestStage = "unpaid" | "withdrawn" | RequestStatus;

export function requestStage(r: { status: RequestStatus; paidAt: string | null; cancelledAt: string | null }): RequestStage {
  if (r.cancelledAt) return "withdrawn";
  if (r.status === "requested" && !r.paidAt) return "unpaid";
  return r.status;
}

export const STAGE_LABELS: Record<RequestStage, string> = {
  unpaid: "Awaiting payment",
  withdrawn: "Withdrawn",
  ...STATUS_LABELS,
};

/**
 * Mirrors private.is_weight_loss_name: a name is a weight-loss medicine when it contains the first
 * word of one on the clinic's list (Mounjaro 5 mg, Wegovy pen). The database checks again.
 */
export function isWeightLossName(name: string, weightLossNames: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return weightLossNames.some((n) => {
    const word = n.trim().split(" ")[0]?.toLowerCase();
    return word ? lower.includes(word) : false;
  });
}
