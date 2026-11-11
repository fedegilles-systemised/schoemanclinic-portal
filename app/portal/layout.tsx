import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { getAvatarUrl } from "@/lib/data/profile";
import { getNotifications } from "@/lib/data/shell";
import { getPortalPatient, getPortalPatients } from "@/lib/portal/patient";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended) redirect("/login?error=no-access");
  if (!user.hasPatientView) redirect(homePathFor(user) ?? "/login?error=no-access");

  const [notifications, avatarUrl, patients, current] = await Promise.all([
    getNotifications(user.id),
    getAvatarUrl(user.avatarPath),
    getPortalPatients(),
    getPortalPatient(),
  ]);

  return (
    <AppShell
      kind="patient"
      crumb="Home"
      user={{ name: user.fullName, roleLabel: user.roles.includes("patient") ? "Patient" : "Guardian" }}
      notifications={notifications}
      avatarUrl={avatarUrl}
      patients={current ? { list: patients.map((p) => ({ id: p.id, name: p.is_self ? `${p.first_name} ${p.last_name} (you)` : `${p.first_name} ${p.last_name}` })), currentId: current.id } : undefined}
      sessionKind={user.isStaff ? "staff" : "patient"}
      roles={user.roles}
      switchTo={user.isStaff ? { href: "/clinic", label: "Clinic view" } : undefined}
    >
      {children}
    </AppShell>
  );
}
