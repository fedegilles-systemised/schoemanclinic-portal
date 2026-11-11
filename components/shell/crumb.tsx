"use client";

import { usePathname } from "next/navigation";

/** The line above the page title. The profile screens say where they are; the rest keep their layout's line. */
export function Crumb({ crumb, profileHref }: { crumb: string; profileHref: string }) {
  const pathname = usePathname();
  const text = pathname === profileHref ? "Account / Profile" : pathname.startsWith("/clinic/team") ? "Clinic / Team and settings" : pathname.startsWith("/clinic/activity") ? "Clinic / Activity" : pathname.startsWith("/clinic/calendar") ? "Today / Calendar" : pathname.startsWith("/clinic/patients") ? "Patients / Patient list" : pathname.startsWith("/clinic/education") ? "Clinic / Education" : pathname.startsWith("/clinic/booking") ? "Today / Booking settings" : pathname.startsWith("/clinic/hr") ? "Clinic / BrightHR" : crumb;
  return <div className="type-eyebrow min-w-0 flex-1 truncate text-content-muted">{text}</div>;
}
