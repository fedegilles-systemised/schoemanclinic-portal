import type { Database } from "@/lib/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  pa: "PA",
  health_coach: "Health coach",
  nurse: "Nurse",
  admin: "Admin",
};
