import { Wordmark } from "@/components/ui/wordmark";

import { NavRows, type NavCounts, type PortalKind } from "./nav";

export type ShellUser = { name: string; roleLabel: string };

/** Wordmark, portal label and navigation. The signed-in person is in the account menu. */
function SidebarContent({
  kind,
  currentHref,
  counts,
}: {
  kind: PortalKind;
  currentHref: string;
  counts?: NavCounts;
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
    </div>
  );
}

export { SidebarContent };
