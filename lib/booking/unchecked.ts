import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A new patient who booked online and, two working days later, has no invitation and no account is reminded to
 * the admins and PAs, once, with a link and no name (decided 18 November 2026). They are marked as reminded
 * only after the notice is stored, so a failure is tried again the next day.
 */
export async function remindUncheckedOnlineBookings(): Promise<{ patients: number; told: number }> {
  const admin = createAdminClient();
  const unchecked = await admin.rpc("unchecked_online_patients");
  if (unchecked.error) throw new Error("Could not list the online bookings to check.");
  const ids = unchecked.data.map((r) => r.for_patient);
  if (ids.length === 0) return { patients: 0, told: 0 };

  const { data: roles, error } = await admin.from("user_roles").select("user_id, profile:profiles!user_roles_user_id_fkey(status)").in("role", ["admin", "pa"]);
  const recipients = new Set((roles ?? []).filter((r) => r.profile?.status === "active").map((r) => r.user_id));
  if (error || recipients.size === 0) throw new Error("No one to remind about the online bookings.");

  const many = ids.length > 1;
  const inserted = await admin.from("notifications").insert(
    [...recipients].map((userId) => ({
      user_id: userId,
      topic: "appointments" as const,
      title: "Online bookings still to check",
      body: many
        ? `${ids.length} patients who booked online two working days ago have not been checked or invited yet. Open the diary to check them.`
        : "A patient who booked online two working days ago has not been checked or invited yet. Open the diary to check them.",
      link: "/clinic/diary",
    })),
  );
  if (inserted.error) throw new Error("The reminder was not stored.");
  await admin.rpc("mark_online_check_reminded", { _patients: ids });
  return { patients: ids.length, told: recipients.size };
}
