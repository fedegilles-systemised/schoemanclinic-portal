import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, GraduationCap, PencilLine } from "lucide-react";

import { CreateCourseForm } from "@/components/education/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { listCourses } from "@/lib/data/education";

export const metadata: Metadata = { title: "Education · The Schoeman Clinic" };

/** The education library. Admins build courses; every team member can read them and assign them from a patient's record. */
export default async function EducationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const courses = await listCourses();

  return (
    <>
      <PageHeader
        eyebrow="Education"
        title="Education "
        accent="library"
        description="Courses made of sections and lessons. A published course shows on a patient's portal once it is added from their record."
      />
      {user.isAdmin ? (
        <Card className="mb-8 max-w-2xl">
          <CardHeader>
            <CardTitle>New course</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCourseForm />
          </CardContent>
        </Card>
      ) : null}
      {courses.length === 0 ? (
        <EmptyState>No courses yet. {user.isAdmin ? "Create the first one above." : "An admin adds them."}</EmptyState>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/clinic/education/${course.id}`} className="block h-full text-content no-underline">
                <Card className="h-full gap-0 overflow-hidden p-0 hover:border-secondary-border">
                  {course.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from private storage
                    <img src={course.coverUrl} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-surface-sunken" aria-hidden>
                      <GraduationCap className="size-8 text-content-muted" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="type-card-title">{course.title}</h2>
                      <StatusPill tone={course.published ? "success" : "neutral"} icon={course.published ? CircleCheck : PencilLine} label={course.published ? "Published" : "Draft"} />
                    </div>
                    {course.description ? <p className="type-small text-content-muted">{course.description}</p> : null}
                    <p className="type-small mt-auto text-content-muted tabular-nums">
                      {course.moduleCount} {course.moduleCount === 1 ? "lesson" : "lessons"}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
