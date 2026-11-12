"use client";

import { usePathname } from "next/navigation";

/** The line above the page title. The profile screens say where they are; the rest keep their layout's line. */
export function Crumb({ crumb, profileHref }: { crumb: string; profileHref: string }) {
  const pathname = usePathname();
  const text = pathname === profileHref ? "Account / Profile" : pathname.startsWith("/clinic/team") ? "Clinic / Team and settings" : pathname.startsWith("/clinic/activity") ? "Clinic / Activity" : pathname.startsWith("/clinic/calendar") ? "Today / Calendar" : pathname.startsWith("/clinic/patients") ? "Patients / Patient list" : pathname.startsWith("/clinic/education") ? "Clinic / Education" : pathname.startsWith("/clinic/booking") ? "Today / Booking settings" : pathname.startsWith("/clinic/hr") ? "Clinic / BrightHR" : pathname.startsWith("/clinic/prescriptions") ? "Patients / Prescriptions" : pathname.startsWith("/clinic/feedback") ? "Patients / Feedback" : pathname.startsWith("/portal/feedback") ? "Your feedback" : pathname.startsWith("/portal/forms") ? "Forms" : pathname.startsWith("/portal/prescriptions") ? "Prescriptions" : pathname.startsWith("/portal/education") ? "Education" : pathname.startsWith("/portal/wearables") ? "Wearables" : pathname.startsWith("/portal/appointments") ? "Appointments" : pathname.startsWith("/portal/results") ? "My results" : pathname.startsWith("/portal/questions") ? "Ask the clinic" : pathname.startsWith("/portal/documents") ? "Letters and documents" : pathname.startsWith("/portal/privacy") ? "Privacy and consent" : pathname.startsWith("/clinic/questions") ? "Patients / Questions" : pathname.startsWith("/clinic/safeguarding") ? "Clinical / Safeguarding alerts" : crumb;
  return <div className="type-eyebrow min-w-0 flex-1 truncate text-content-muted">{text}</div>;
}
