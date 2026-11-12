import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, Eye, FileText, GraduationCap, PencilLine, PlayCircle } from "lucide-react";
import { z } from "zod";

import { AddLessonForm, ArchivePartButton, CoverForm, EditCourseForm, RenameSectionForm, SectionForm } from "@/components/education/forms";
import { MoveButtons } from "@/components/education/move-buttons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/data/education";

export const metadata: Metadata = { title: "Course · Clinic Hub" };

/**
 * A course in the builder: the outline of sections and lessons, which admins reorder, rename and
 * add to, with each lesson opening in the editor; the course details and cover beside it. The rest
 * of the team reads the outline and previews lessons as a patient sees them.
 */
export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ moved?: string }> }) {
  const { id } = await params;
  const { moved } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const course = await getCourse(id);
  if (!course) notFound();
  const admin = user.isAdmin;
  const lessonCount = course.sections.reduce((n, s) => n + s.modules.length, 0);
  const drafts = course.sections.reduce((n, s) => n + s.modules.filter((m) => !m.published).length, 0);

  return (
    <>
      <Link href="/clinic/education" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Education library
      </Link>
      <PageHeader
        eyebrow={course.published ? "Published course" : "Draft course"}
        title={`${course.title} `}
        description={`${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"} in ${course.sections.length} ${course.sections.length === 1 ? "section" : "sections"}${drafts ? `, ${drafts} still ${drafts === 1 ? "a draft" : "drafts"}` : ""}.`}
      >
        <Link href={`/clinic/education/${course.id}/preview`} className="type-button-label inline-flex items-center gap-2 text-content no-underline">
          <Eye className="size-4" aria-hidden />
          Preview as a patient
        </Link>
      </PageHeader>

      {moved === "failed" ? (
        <div className="mb-6">
          <Alert variant="warning">
            <AlertDescription>The course was changed by someone else at the same time, so that move was not made. Here is the course as it is now: please try again.</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {course.sections.length === 0 ? <EmptyState>{admin ? "Start with a section, then add lessons to it." : "No sections yet."}</EmptyState> : null}
          {course.sections.map((section, sectionIndex) => (
            <section key={section.id} aria-labelledby={`section-${section.id}`} className="border border-surface-border bg-surface-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
                <div className="flex flex-col">
                  <span className="type-eyebrow text-content-muted">Section {sectionIndex + 1}</span>
                  <h2 id={`section-${section.id}`} className="type-card-title">
                    {section.title}
                  </h2>
                </div>
                {admin ? (
                  <div className="flex items-center gap-1">
                    <MoveButtons courseId={course.id} id={section.id} kind="section" label={section.title} first={sectionIndex === 0} last={sectionIndex === course.sections.length - 1} />
                    <ArchivePartButton courseId={course.id} id={section.id} kind="section" label={section.title} />
                  </div>
                ) : null}
              </div>

              {section.modules.length === 0 ? (
                <p className="type-small px-4 py-3 text-content-muted">No lessons in this section yet.</p>
              ) : (
                <ol className="flex flex-col divide-y divide-surface-border">
                  {section.modules.map((lesson, lessonIndex) => {
                    const firstOverall = sectionIndex === 0 && lessonIndex === 0;
                    const lastOverall = sectionIndex === course.sections.length - 1 && lessonIndex === section.modules.length - 1;
                    const href = admin ? `/clinic/education/${course.id}/lessons/${lesson.id}` : `/clinic/education/${course.id}/preview?lesson=${lesson.id}`;
                    return (
                      <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <span className="type-small w-6 text-content-muted tabular-nums">{lessonIndex + 1}</span>
                        <Link href={href} className="type-body min-w-0 flex-1 text-content">
                          {lesson.title}
                        </Link>
                        <span className="flex items-center gap-2 text-content-muted">
                          {lesson.videoUrl ? <PlayCircle className="size-4" role="img" aria-label="Has a video" /> : null}
                          {lesson.files.length ? <FileText className="size-4" role="img" aria-label={`${lesson.files.length} ${lesson.files.length === 1 ? "file" : "files"}`} /> : null}
                        </span>
                        <StatusPill tone={lesson.published ? "success" : "neutral"} icon={lesson.published ? CircleCheck : PencilLine} label={lesson.published ? "Published" : "Draft"} />
                        {admin ? (
                          <div className="flex items-center gap-1">
                            <MoveButtons courseId={course.id} id={lesson.id} kind="lesson" label={lesson.title} first={firstOverall} last={lastOverall} />
                            <ArchivePartButton courseId={course.id} id={lesson.id} kind="module" label={lesson.title} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}

              {admin ? (
                <div className="flex flex-col gap-4 border-t border-surface-border px-4 py-4">
                  <AddLessonForm courseId={course.id} sectionId={section.id} />
                  <details>
                    <summary className="type-small cursor-pointer text-content-muted">Rename this section</summary>
                    <div className="pt-3">
                      <RenameSectionForm courseId={course.id} sectionId={section.id} title={section.title} />
                    </div>
                  </details>
                </div>
              ) : null}
            </section>
          ))}
          {admin ? (
            <div>
              <SectionHeader title="Add a " accent="section" className="mb-3" />
              <SectionForm courseId={course.id} nextPosition={course.sections.length} />
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6" aria-label="Course details">
          <Card className="gap-0 overflow-hidden p-0">
            {course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from private storage
              <img src={course.coverUrl} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-surface-sunken" aria-hidden>
                <GraduationCap className="size-8 text-content-muted" />
              </div>
            )}
            {admin ? (
              <div className="p-5">
                <CoverForm courseId={course.id} hasCover={Boolean(course.coverUrl)} />
              </div>
            ) : null}
          </Card>
          {admin ? (
            <Card>
              <CardHeader>
                <CardTitle>Course details</CardTitle>
              </CardHeader>
              <CardContent>
                <EditCourseForm courseId={course.id} title={course.title} description={course.description} published={course.published} />
              </CardContent>
            </Card>
          ) : course.description ? (
            <p className="type-body">{course.description}</p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
