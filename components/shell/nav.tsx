"use client";

import {
  Activity,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  MessageSquare,
  MessageSquareHeart,
  Pill,
  Settings,
  Shield,
  Upload,
  Users,
  Watch,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import type { AppRole } from "@/lib/invitations/constants";
import { cn } from "@/lib/utils";

import { ComingSoon } from "./coming-soon";

type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Set only for screens that exist. The rest show as disabled with "Coming soon". */
  href?: string;
  countKey?: "review" | "imports";
  /** Shown only to people who hold one of these roles. Everyone sees an item with none set. */
  roles?: readonly AppRole[];
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
        { label: "My results", icon: Activity, href: "/portal/results" },
        { label: "Upload results", icon: Upload },
        { label: "Education", icon: GraduationCap, href: "/portal/education" },
        { label: "Wearables", icon: Watch, href: "/portal/wearables" },
        { label: "Prescriptions", icon: Pill, href: "/portal/prescriptions" },
        { label: "Appointments", icon: CalendarDays, href: "/portal/appointments" },
        { label: "Ask the clinic", icon: MessageSquare, href: "/portal/questions" },
        { label: "Forms", icon: ClipboardCheck, href: "/portal/forms" },
        { label: "Letters and documents", icon: FileText, href: "/portal/documents" },
        { label: "Privacy and consent", icon: Shield, href: "/portal/privacy" },
      ],
    },
  ],
  clinic: [
    {
      eyebrow: "Today",
      items: [
        { label: "Dashboard", icon: LayoutGrid, href: "/clinic" },
        { label: "Diary", icon: CalendarRange, href: "/clinic/diary" },
        { label: "My calendar", icon: CalendarDays, href: "/clinic/calendar" },
        { label: "Booking settings", icon: Clock, href: "/clinic/booking" },
      ],
    },
    {
      eyebrow: "Patients",
      items: [
        { label: "Patient list", icon: Users, href: "/clinic/patients" },
        { label: "Questions", icon: MessageSquare, href: "/clinic/questions" },
        { label: "Prescriptions", icon: Pill, href: "/clinic/prescriptions", roles: ["doctor", "pa", "admin"] },
        { label: "Feedback", icon: MessageSquareHeart, href: "/clinic/feedback", roles: ["doctor", "pa", "admin"] },
        { label: "Results review", icon: ClipboardList, href: "/clinic/results", countKey: "review" },
        { label: "Import queue", icon: Inbox, href: "/clinic/results#imports", countKey: "imports", roles: ["pa", "doctor", "nurse", "admin"] },
        { label: "Lab orders", icon: FlaskConical },
      ],
    },
    { eyebrow: "Clinical", items: [{ label: "Safeguarding alerts", icon: Shield, href: "/clinic/safeguarding", roles: ["doctor"] }] },
    {
      eyebrow: "Clinic",
      items: [
        { label: "Team and settings", icon: Settings, href: "/clinic/team", roles: ["pa", "admin", "doctor"] },
        { label: "Education", icon: GraduationCap, href: "/clinic/education" },
        { label: "Activity", icon: Activity, href: "/clinic/activity", roles: ["admin"] },
        { label: "BrightHR", icon: Briefcase, href: "/clinic/hr" },
      ],
    },
  ],
};

const rowClass =
  "type-table flex h-nav-row items-center gap-3 border-l-2 border-transparent px-3 text-content-muted no-underline";

function NavRows({ kind, counts, roles }: { kind: PortalKind; counts?: NavCounts; roles: readonly AppRole[] }) {
  const pathname = usePathname();
  // An item with a role list is hidden from everyone else, and a group left empty goes with it.
  const groups = NAV[kind]
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.some((role) => roles.includes(role))) }))
    .filter((group) => group.items.length > 0);
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {groups.map((group, index) => (
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
            const current = item.href === pathname || (item.href !== "/clinic" && item.href !== "/portal" && pathname.startsWith(`${item.href}/`));
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
