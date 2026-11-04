import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/ui/demo-banner";
import type { ShellLocation, ShellNotification } from "@/lib/data/shell";
import { getPublicEnv } from "@/lib/env";
import type { AppRole } from "@/lib/invitations/constants";
import type { SessionKind } from "@/lib/supabase/session-limits";

import { LocationSwitcher } from "./location-switcher";
import { MobileNav } from "./mobile-nav";
import type { NavCounts, PortalKind } from "./nav";
import { NotificationsBell } from "./notifications-bell";
import { SidebarContent, type ShellUser } from "./sidebar-content";
import { Crumb } from "./crumb";
import { SessionGuard } from "./session-guard";
import { UserMenu } from "./user-menu";

type AppShellProps = {
  kind: PortalKind;
  crumb: string;
  user: ShellUser;
  notifications: ShellNotification[];
  counts?: NavCounts;
  /** Clinic only. */
  locations?: ShellLocation[];
  /** The other area, for a person with both a staff role and a patient view. */
  switchTo?: { href: string; label: string };
  /** Which session limits apply: staff, or a patient or guardian with no staff role. */
  sessionKind: SessionKind;
  /** The person's roles, for the menu: some items are for PAs and admins only. */
  roles: readonly AppRole[];
  /** A short-lived address for the person's photo, if they have one. */
  avatarUrl?: string | null;
  children: React.ReactNode;
};

function AppShell({ kind, crumb, user, notifications, counts, locations, switchTo, sessionKind, roles, avatarUrl, children }: AppShellProps) {
  const demo = getPublicEnv().NEXT_PUBLIC_DEMO === "true";
  const profileHref = kind === "patient" ? "/portal/profile" : "/clinic/profile";
  const sidebar = <SidebarContent kind={kind} counts={counts} roles={roles} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <SessionGuard kind={sessionKind} />
      {demo ? <DemoBanner className="sticky top-0 z-40" /> : null}
      <div className="grid flex-1 grid-cols-1 shell:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-surface-border shell:block">
          {sidebar}
        </aside>
        <div className="min-w-0 px-5 pb-16 shell:px-10">
          <header className="mb-9 flex h-topbar items-center gap-3 border-b border-surface-border">
            <MobileNav>{sidebar}</MobileNav>
            <Crumb crumb={crumb} profileHref={profileHref} />
            {switchTo ? (
              <Button asChild variant="ghost" className="hidden phone:inline-flex">
                <Link href={switchTo.href}>{switchTo.label}</Link>
              </Button>
            ) : null}
            {locations ? (
              <Suspense>
                <LocationSwitcher locations={locations} />
              </Suspense>
            ) : null}
            <NotificationsBell notifications={notifications} />
            <UserMenu name={user.name} roleLabel={user.roleLabel} avatarUrl={avatarUrl ?? null} profileHref={profileHref} switchTo={switchTo} />
          </header>
          <main className="max-w-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

export { AppShell };
