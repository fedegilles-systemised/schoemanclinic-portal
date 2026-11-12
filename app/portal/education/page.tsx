import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCompletedLessons, getPortalCourseIds, getPortalPatientId, listCourses } from "@/lib/data/education";

export const metadata: Metadata = { title: "Education · The Schoeman Clinic" };

/** The courses the clinic has added to this patient's portal, each with its progress. */
export default async function PortalEducationPage() {
  const [all, mine, patient] = await Promise.all([listCourses(), getPortalCourseIds(), getPortalPatientId()]);
  const courses = all.filter((course) => course.published && mine.has(course.id));
  const completed = patient ? await getCompletedLessons(patient.id) : new Set<string>();
  return (
    <>
      <PageHeader eyebrow="Education" title="Your " accent="courses" description="Courses your clinic team has chosen for you." />
      {courses.length === 0 ? (
        <EmptyState>Nothing here yet. Your clinic team will add courses for you.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const total = course.lessonIds.length;
            const done = course.lessonIds.filter((id) => completed.has(id)).length;
            const percent = total ? Math.round((done / total) * 100) : 0;
            const label = done === 0 ? "Start course" : done === total ? "Review course" : "Continue";
            return (
              <Card key={course.id} className="flex flex-col gap-0 overflow-hidden p-0">
                {course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from private storage
                  <img src={course.coverUrl} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-surface-sunken" aria-hidden>
                    <GraduationCap className="size-8 text-content-muted" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="type-card-title">{course.title}</h2>
                  {course.description ? <p className="type-small text-content-muted">{course.description}</p> : null}
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <p className="type-small text-content-muted tabular-nums">
                      {done} of {total} {total === 1 ? "lesson" : "lessons"} complete
                    </p>
                    <div className="h-1.5 w-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${done} of ${total} lessons complete`} aria-label={`${course.title} progress`}>
                      <div className="h-full bg-secondary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div>
                    <Button variant={done === total && total > 0 ? "outline" : "secondary"} size="sm" asChild>
                      <Link href={`/portal/education/${course.id}`}>{label}</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
