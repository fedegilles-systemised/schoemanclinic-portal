// Shared by server and client code. Kept out of the "use client" form file,
// because a server component cannot read a constant exported from there.
export const RELATIONSHIP_LABELS = {
  primary_doctor: "Primary doctor",
  doctor: "Doctor",
  nurse: "Nurse",
  pa: "PA",
  health_coach: "Health coach",
} as const;
