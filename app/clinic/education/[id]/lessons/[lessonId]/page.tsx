import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, Eye, FileText, ImageIcon, PencilLine } from "lucide-react";
import { z } from "zod";

import { ArchiveFileButton, LessonEditorForm, LessonFileForm } from "@/components/education/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/data/education";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit lesson · Clinic Hub" };

/** The lesson editor, for admins: the course outline to move between lessons, and the lesson beside it. */
export default async function LessonEditorPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isAdmin) redirect(`/clinic/education/${id}`);
  const course = await getCourse(id);
  if (!course) notFound();
  const section = course.sections.find((s) => s.modules.some((m) => m.id === lessonId));
  const lesson = section?.modules.find((m) => m.id === lessonId);
  if (!section || !lesson) notFound();

  return (
    <>
      <Link href={`/clinic/education/${course.id}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        {course.title}
      </Link>
      <PageHeader eyebrow={section.title} title={`${lesson.title} `}>
        <div className="flex items-center gap-4">
          <StatusPill tone={lesson.published ? "success" : "neutral"} icon={lesson.published ? CircleCheck : PencilLine} label={lesson.published ? "Published" : "Draft"} />
          <Link href={`/clinic/education/${course.id}/preview?lesson=${lesson.id}`} className="type-button-label inline-flex items-center gap-2 text-content no-underline">
            <Eye className="size-4" aria-hidden />
            Preview
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-8 shell:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Lessons in this course" className="order-2 flex flex-col gap-4 shell:sticky shell:top-6 shell:order-1 shell:self-start">
          {course.sections.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <span className="type-eyebrow text-content-muted">{s.title}</span>
              <ol className="flex flex-col">
                {s.modules.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/clinic/education/${course.id}/lessons/${m.id}`}
                      aria-current={m.id === lesson.id ? "page" : undefined}
                      className={cn("type-body block px-2 py-1.5 text-content no-underline hover:bg-surface-selected", m.id === lesson.id && "bg-surface-selected font-medium")}
                    >
                      {m.title}
                      {!m.published ? <span className="type-small text-content-muted"> · draft</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>

        <div className="order-1 flex min-w-0 flex-col gap-6 shell:order-2">
          <Card>
            <CardContent>
              <LessonEditorForm
                key={lesson.id}
                courseId={course.id}
                lessonId={lesson.id}
                title={lesson.title}
                videoUrl={lesson.videoUrl}
                content={lesson.content ?? (lesson.body ? { type: "doc", content: lesson.body.split(/\n{2,}/).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) } : null)}
                published={lesson.published}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {lesson.files.length ? (
                <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
                  {lesson.files.map((file) => {
                    const Icon = file.contentType === "application/pdf" ? FileText : ImageIcon;
                    return (
                      <li key={file.id} className="flex items-center gap-3 px-3 py-1.5">
                        <Icon className="size-4 text-content-muted" aria-hidden />
                        {file.url ? (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="type-body min-w-0 flex-1 truncate text-content">
                            {file.name}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          <span className="type-body min-w-0 flex-1 truncate">{file.name}</span>
                        )}
                        <ArchiveFileButton courseId={course.id} fileId={file.id} name={file.name} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="type-small text-content-muted">No files yet. Handouts and images added here appear under the lesson for patients.</p>
              )}
              <LessonFileForm courseId={course.id} lessonId={lesson.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
