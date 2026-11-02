import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wordmark } from "@/components/ui/wordmark";
import { initials } from "@/lib/format";

import { NavRows, type NavCounts, type PortalKind } from "./nav";

export type ShellUser = { name: string; roleLabel: string };

/** Wordmark, portal label, navigation and the signed-in person. */
function SidebarContent({
  kind,
  currentHref,
  counts,
  user,
}: {
  kind: PortalKind;
  currentHref: string;
  counts?: NavCounts;
  user: ShellUser;
}) {
  return (
    <div className="flex h-full flex-col px-4 pt-7 pb-5">
      <div className="px-3 pb-6">
        <Wordmark />
        <div className="type-eyebrow mt-2.5 text-content-muted">
          {kind === "patient" ? "Patient portal" : "Clinic portal"}
        </div>
      </div>
      <NavRows kind={kind} currentHref={currentHref} counts={counts} />
      <div className="mt-auto flex items-center gap-3 border-t border-surface-border px-3 pt-4">
        <Avatar>
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="type-small truncate font-semibold">{user.name}</div>
          <div className="type-small truncate text-content-muted">{user.roleLabel}</div>
        </div>
      </div>
    </div>
  );
}

export { SidebarContent };
