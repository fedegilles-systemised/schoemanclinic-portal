"use client";

import { usePathname } from "next/navigation";

/** The line above the page title. The profile screens say where they are; the rest keep their layout's line. */
export function Crumb({ crumb, profileHref }: { crumb: string; profileHref: string }) {
  const pathname = usePathname();
  const text = pathname === profileHref ? "Account / Profile" : pathname.startsWith("/clinic/team") ? "Clinic / Team and settings" : pathname.startsWith("/clinic/activity") ? "Clinic / Activity" : crumb;
  return <div className="type-eyebrow min-w-0 flex-1 truncate text-content-muted">{text}</div>;
}
