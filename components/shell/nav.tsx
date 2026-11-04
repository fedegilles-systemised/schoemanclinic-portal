"use client";

import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  Home,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Pill,
  Settings,
  Shield,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ComingSoon } from "./coming-soon";

type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Set only for screens that exist. The rest show as disabled with "Coming soon". */
  href?: string;
  countKey?: "review" | "imports";
};

type NavGroup = { eyebrow?: string; items: NavItem[] };

export type PortalKind = "patient" | "clinic";
export type NavCounts = { review: number; imports: number };

const NAV: Record<PortalKind, NavGroup[]> = {
  patient: [
    {
      items: [
        { label: "Home", icon: Home, href: "/portal" },
        { label: "Lab orders", icon: FlaskConical },
        { label: "My results", icon: Activity },
        { label: "Upload results", icon: Upload },
        { label: "Prescriptions", icon: Pill },
        { label: "Appointments", icon: CalendarDays },
        { label: "Ask the clinic", icon: MessageSquare },
        { label: "Letters and documents", icon: FileText },
        { label: "Privacy and consent", icon: Shield },
      ],
    },
  ],
  clinic: [
    { eyebrow: "Today", items: [{ label: "Dashboard", icon: LayoutGrid, href: "/clinic" }] },
    {
      eyebrow: "Patients",
      items: [
        { label: "Patient list", icon: Users },
        { label: "Results review", icon: ClipboardList, countKey: "review" },
        { label: "Import queue", icon: Inbox, countKey: "imports" },
        { label: "Lab orders", icon: FlaskConical },
      ],
    },
    { eyebrow: "Clinical", items: [{ label: "Safeguarding alerts", icon: Shield }] },
    { eyebrow: "Clinic", items: [{ label: "Team and settings", icon: Settings }] },
  ],
};

const rowClass =
  "type-table flex h-nav-row items-center gap-3 border-l-2 border-transparent px-3 text-content-muted no-underline";

function NavRows({ kind, counts }: { kind: PortalKind; counts?: NavCounts }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV[kind].map((group, index) => (
        <div key={group.eyebrow ?? index} className="flex flex-col gap-0.5">
          {group.eyebrow ? (
            <div className="type-eyebrow px-3 pt-4.5 pb-2 text-content-muted">{group.eyebrow}</div>
          ) : null}
          {group.items.map((item) => {
            const count = item.countKey ? counts?.[item.countKey] : undefined;
            const body = (
              <>
                <item.icon aria-hidden />
                <span>{item.label}</span>
                {count ? <Badge className="ml-auto opacity-100">{count}</Badge> : null}
              </>
            );
            if (!item.href) {
              return (
                <ComingSoon key={item.label} className="block">
                  <span className={cn(rowClass, "cursor-not-allowed opacity-45")}>{body}</span>
                </ComingSoon>
              );
            }
            const current = item.href === pathname;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  rowClass,
                  "transition-colors duration-150 ease-out hover:bg-surface-sunken hover:text-content",
                  current && "border-secondary-border bg-surface-selected text-content",
                )}
              >
                {body}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export { NavRows };
