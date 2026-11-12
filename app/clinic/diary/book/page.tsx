import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientSearch } from "@/components/diary/forms";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New booking · Clinic Hub" };

/** A new booking from the diary: find the patient, then choose the type, clinician and time. */
export default async function DiaryBookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  return (
    <>
      <Link href="/clinic/diary" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Diary
      </Link>
      <PageHeader eyebrow="Diary" title="New " accent="booking" description="Find the patient, then choose the appointment, the clinician and a free time." />
      <PatientSearch />
    </>
  );
}
