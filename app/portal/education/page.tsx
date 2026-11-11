import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCourseIds, listCourses } from "@/lib/data/education";

export const metadata: Metadata = { title: "Education · The Schoeman Clinic" };

/** The courses the clinic has added to this patient's portal. Row-level security returns only those. */
export default async function PortalEducationPage() {
  const [all, mine] = await Promise.all([listCourses(), getPortalCourseIds()]);
  const courses = all.filter((course) => course.published && mine.has(course.id));
  return (
    <>
      <PageHeader eyebrow="Education" title="Your " accent="courses" description="Courses your clinic team has chosen for you." />
      {courses.length === 0 ? (
        <EmptyState>Nothing here yet. Your clinic team will add courses for you.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <Link key={course.id} href={`/portal/education/${course.id}`} className="no-underline">
              <Card>
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription>
                    {course.description ? `${course.description} ` : ""}
                    {course.moduleCount} {course.moduleCount === 1 ? "module" : "modules"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
