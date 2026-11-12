import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { CoursePlayer } from "@/components/education/player";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/data/education";

export const metadata: Metadata = { title: "Preview course · Clinic Hub" };

/** The course as a patient takes it, for the team: drafts included and marked, and nothing recorded. */
export default async function CoursePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const { id } = await params;
  const { lesson } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const course = await getCourse(id);
  if (!course) notFound();
  const lessonId = lesson && z.uuid().safeParse(lesson).success ? lesson : undefined;

  return (
    <>
      <Link href={lessonId && user.isAdmin ? `/clinic/education/${course.id}/lessons/${lessonId}` : `/clinic/education/${course.id}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        {lessonId && user.isAdmin ? "Back to the editor" : "Back to the course"}
      </Link>
      <PageHeader eyebrow="Preview" title={`${course.title} `} description={course.description ?? undefined} />
      <div className="mb-8">
        <Alert variant="info">
          <AlertDescription>
            This is how patients see the course{course.published ? "" : " once it is published"}. Draft lessons are shown here, marked, but patients do not see them.
          </AlertDescription>
        </Alert>
      </div>
      <CoursePlayer course={course} lessonId={lessonId} completed={new Set()} basePath={`/clinic/education/${course.id}/preview`} mode="preview" canComplete={false} />
    </>
  );
}
