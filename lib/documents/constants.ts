import type { Database } from "@/lib/database.types";

export type DocumentKind = Database["public"]["Enums"]["doc_kind"];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  letter: "Letter",
  lab_report: "Lab report",
  patient_upload: "Sent by the patient",
  referral: "Referral",
  other: "Document",
};

/** What the team may upload from the record. Lab reports go through results, not here. */
export const UPLOAD_KINDS = ["letter", "referral", "other"] as const;
