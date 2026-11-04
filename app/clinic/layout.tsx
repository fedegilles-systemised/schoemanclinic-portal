import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { getClinicNavCounts } from "@/lib/data/clinic";
import { getAvatarUrl } from "@/lib/data/profile";
import { getLocations, getNotifications } from "@/lib/data/shell";

const ROLE_LABELS = { doctor: "Doctor", pa: "PA", health_coach: "Health coach", admin: "Admin", patient: "Patient" } as const;

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended) redirect("/login?error=no-access");
  if (!user.isStaff) redirect(homePathFor(user) ?? "/login?error=no-access");

  const [notifications, locations, counts, avatarUrl] = await Promise.all([
    getNotifications(user.id),
    getLocations(),
    getClinicNavCounts(),
    getAvatarUrl(user.avatarPath),
  ]);
  const staffRole = user.roles.find((role) => role !== "patient") ?? "admin";

  return (
    <AppShell
      kind="clinic"
      crumb="Today / Dashboard"
      user={{ name: user.fullName, roleLabel: ROLE_LABELS[staffRole] }}
      notifications={notifications}
      avatarUrl={avatarUrl}
      counts={counts}
      sessionKind="staff"
      locations={locations}
      switchTo={user.hasPatientView ? { href: "/portal", label: "Patient view" } : undefined}
    >
      {children}
    </AppShell>
  );
}
