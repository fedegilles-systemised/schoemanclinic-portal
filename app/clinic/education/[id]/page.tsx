import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";

import { ArchivePartButton, EditCourseForm, ModuleForm, SectionForm } from "@/components/education/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/data/education";

export const metadata: Metadata = { title: "Course · The Schoeman Clinic" };

/** One course: admins edit it and add sections and modules; the rest of the team reads it. */
export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const course = await getCourse(id);
  if (!course) notFound();
  const admin = user.isAdmin;

  return (
    <>
      <Link href="/clinic/education" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Education library
      </Link>
      <PageHeader eyebrow={course.published ? "Published course" : "Draft course"} title={`${course.title} `} description={course.description ?? undefined} />

      {admin ? (
        <Card className="mb-10 max-w-2xl">
          <CardHeader>
            <CardTitle>Course details</CardTitle>
          </CardHeader>
          <CardContent>
            <EditCourseForm courseId={course.id} title={course.title} description={course.description} published={course.published} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-10">
        {course.sections.length === 0 ? <EmptyState>No sections yet.</EmptyState> : null}
        {course.sections.map((section) => (
          <section key={section.id} aria-labelledby={`section-${section.id}`} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id={`section-${section.id}`} className="type-section-title">
                {section.title}
              </h2>
              {admin ? <ArchivePartButton courseId={course.id} id={section.id} kind="section" label={section.title} /> : null}
            </div>
            {section.modules.length === 0 ? <EmptyState>No modules in this section yet.</EmptyState> : null}
            {section.modules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{module.title}</CardTitle>
                    {admin ? <ArchivePartButton courseId={course.id} id={module.id} kind="module" label={module.title} /> : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {module.videoUrl ? (
                    <a href={module.videoUrl} target="_blank" rel="noopener noreferrer" className="type-button-label inline-flex items-center gap-2 text-content no-underline">
                      <ExternalLink className="size-4" aria-hidden />
                      Watch the video
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {module.body ? <p className="type-body whitespace-pre-wrap">{module.body}</p> : null}
                </CardContent>
              </Card>
            ))}
            {admin ? (
              <Card>
                <CardContent className="pt-6">
                  <ModuleForm courseId={course.id} sectionId={section.id} nextPosition={section.modules.length} />
                </CardContent>
              </Card>
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
    </>
  );
}
