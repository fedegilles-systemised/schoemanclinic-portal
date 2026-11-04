import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { getAvatarUrl } from "@/lib/data/profile";
import { getNotifications } from "@/lib/data/shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended) redirect("/login?error=no-access");
  if (!user.hasPatientView) redirect(homePathFor(user) ?? "/login?error=no-access");

  const [notifications, avatarUrl] = await Promise.all([getNotifications(user.id), getAvatarUrl(user.avatarPath)]);

  return (
    <AppShell
      kind="patient"
      crumb="Home"
      user={{ name: user.fullName, roleLabel: user.roles.includes("patient") ? "Patient" : "Guardian" }}
      notifications={notifications}
      avatarUrl={avatarUrl}
      sessionKind={user.isStaff ? "staff" : "patient"}
      switchTo={user.isStaff ? { href: "/clinic", label: "Clinic view" } : undefined}
    >
      {children}
    </AppShell>
  );
}
