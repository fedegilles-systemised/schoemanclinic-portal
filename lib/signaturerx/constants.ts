/** What SignatureRx calls a prescription's state, in the words the team reads. */
export const SRX_STATUS_LABELS: Record<string, string> = {
  sending: "Not confirmed: check SignatureRx",
  failed: "Not sent",
  draft: "Draft in SignatureRx",
  signing: "Waiting for the signature",
  signed: "Signed",
  dispensed: "Dispensed",
  voided: "Voided",
  expired: "Expired",
  contacted: "Patient contacted",
  pending: "With the pharmacy",
  collected: "Collected",
  shipped: "Shipped",
  dispatched: "Dispatched",
};

/** A send that is no longer open, so another one may be started. */
export const SRX_CLOSED_STATUSES = new Set(["failed", "voided", "expired"]);

/** A state that will not change again, so there is no need to ask SignatureRx about it. */
export const SRX_FINAL_STATUSES = new Set(["dispensed", "voided", "expired", "collected"]);

export const SRX_ACTIONS = [
  { value: "draft", label: "Save as a draft in SignatureRx" },
  { value: "issueOnly", label: "Sign and issue it now" },
] as const;

export type SrxAction = (typeof SRX_ACTIONS)[number]["value"];

export function srxStatusLabel(status: string | null): string {
  if (!status) return "Not checked yet";
  return SRX_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}
