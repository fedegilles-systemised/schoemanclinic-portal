import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { CoursePlayer } from "@/components/education/player";
import { PageHeader } from "@/components/ui/page-header";
import { getCompletedLessons, getCourse, getPortalCourseIds, getPortalPatientId } from "@/lib/data/education";

export const metadata: Metadata = { title: "Course · The Schoeman Clinic" };

/**
 * A course in the portal: the outline with progress, and one lesson open at a time. It opens at
 * the first lesson not yet completed.
 */
export default async function PortalCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { lesson, saved } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  // Row-level security returns the course only if it is published and on this person's portal.
  const [course, mine, patient] = await Promise.all([getCourse(id), getPortalCourseIds(), getPortalPatientId()]);
  if (!course || !course.published || !mine.has(course.id) || !patient) notFound();
  const completed = await getCompletedLessons(patient.id);
  const lessonId = lesson && z.uuid().safeParse(lesson).success ? lesson : undefined;

  return (
    <>
      <Link href="/portal/education" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Your courses
      </Link>
      <PageHeader eyebrow="Course" title={`${course.title} `} description={course.description ?? undefined} />
      <CoursePlayer course={course} lessonId={lessonId} completed={completed} basePath={`/portal/education/${course.id}`} mode="patient" canComplete={patient.canAct} saveFailed={saved === "0"} />
    </>
  );
}
