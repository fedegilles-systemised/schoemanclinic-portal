import type { Database } from "@/lib/database.types";

export type DiagnosisStatus = Database["public"]["Enums"]["diagnosis_status"];
export type SafeguardingSeverity = Database["public"]["Enums"]["safeguarding_severity"];

export const DIAGNOSIS_STATUS_LABELS: Record<DiagnosisStatus, string> = {
  active: "Active",
  monitoring: "Monitoring",
  treating: "Treating",
  under_investigation: "Under investigation",
  resolved: "Resolved",
};
export const DIAGNOSIS_STATUSES = Object.keys(DIAGNOSIS_STATUS_LABELS) as DiagnosisStatus[];

export const SEVERITY_LABELS: Record<SafeguardingSeverity, string> = { low: "Low", moderate: "Moderate", high: "High" };
export const SEVERITIES = Object.keys(SEVERITY_LABELS) as SafeguardingSeverity[];

export const ALLERGY_SEVERITIES = ["Mild", "Moderate", "Severe", "Anaphylaxis"] as const;
