import type { Database } from "@/lib/database.types";

export type InvitationKind = Database["public"]["Enums"]["invitation_kind"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type GuardianRelationship = Database["public"]["Enums"]["guardian_relationship"];

/** How long an invitation link works. The database sets the real expiry; this is the wording. */
export const INVITATION_DAYS = 3;

export const KIND_LABELS: Record<InvitationKind, string> = {
  patient: "Patient",
  guardian: "Guardian",
  team: "Team member",
};

export const TEAM_ROLES = ["doctor", "pa", "health_coach", "admin"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  doctor: "Doctor",
  pa: "PA",
  health_coach: "Health coach",
  admin: "Admin",
};

export const RELATIONSHIPS = ["parent", "carer", "power_of_attorney"] as const;
export const RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  parent: "Parent",
  carer: "Carer",
  power_of_attorney: "Power of attorney",
};

/** Admins send every kind. PAs send patient and guardian invitations. Nobody else sends any. */
export function kindsFor(roles: readonly AppRole[]): InvitationKind[] {
  if (roles.includes("admin")) return ["patient", "guardian", "team"];
  if (roles.includes("pa")) return ["patient", "guardian"];
  return [];
}
