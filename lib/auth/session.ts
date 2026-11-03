import "server-only";

import { cache } from "react";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type AppRole = Database["public"]["Enums"]["app_role"];

const STAFF_ROLES: readonly AppRole[] = ["doctor", "pa", "health_coach", "admin"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  roles: AppRole[];
  isStaff: boolean;
  /** Holds the admin role. */
  isAdmin: boolean;
  /** Holds the patient role, or is a verified guardian of a patient. */
  hasPatientView: boolean;
  isSuspended: boolean;
};

/**
 * The signed-in person, once per request. These checks route people to the right
 * area; what they can actually read is decided by row-level security.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, roles, records] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_path, status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.rpc("get_my_patient_record"),
  ]);

  const roleList = (roles.data ?? []).map((row) => row.role);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.data?.full_name ?? "",
    avatarPath: profile.data?.avatar_path ?? null,
    roles: roleList,
    isStaff: roleList.some((role) => STAFF_ROLES.includes(role)),
    isAdmin: roleList.includes("admin"),
    hasPatientView: (records.data ?? []).length > 0,
    isSuspended: profile.data?.status === "suspended",
  };
});

/** Where a person lands after signing in. Null means they have no area to go to. */
export function homePathFor(user: CurrentUser): "/clinic" | "/portal" | null {
  if (user.isSuspended) return null;
  if (user.isStaff) return "/clinic";
  if (user.hasPatientView) return "/portal";
  return null;
}
