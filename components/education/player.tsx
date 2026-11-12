import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Circle, FileText, ImageIcon } from "lucide-react";

import { LessonText, LessonVideo } from "@/components/education/lesson-content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Course, CourseModule, LessonFile } from "@/lib/data/education";
import { completeLesson } from "@/lib/education/actions";
import { cn } from "@/lib/utils";

type Lesson = CourseModule & { sectionTitle: string; number: number };

/** Every lesson in order, numbered from 1, with its section's name. */
export function lessonsInOrder(course: Course, { publishedOnly }: { publishedOnly: boolean }): Lesson[] {
  let number = 0;
  return course.sections.flatMap((section) =>
    section.modules.filter((m) => !publishedOnly || m.published).map((m) => ({ ...m, sectionTitle: section.title, number: ++number })),
  );
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function LessonFiles({ files }: { files: LessonFile[] }) {
  if (files.length === 0) return null;
  return (
    <section aria-labelledby="lesson-files" className="flex flex-col gap-3">
      <h3 id="lesson-files" className="type-eyebrow text-content-muted">
        Downloads
      </h3>
      <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
        {files.map((file) => {
          const Icon = file.contentType === "application/pdf" ? FileText : ImageIcon;
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-2">
              <Icon className="size-4 text-content-muted" aria-hidden />
              {file.url ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="type-body text-content">
                  {file.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="type-body">{file.name}</span>
              )}
              <span className="type-small ml-auto text-content-muted tabular-nums">{fileSize(file.sizeBytes)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A course as a patient takes it: the outline down the side with what is done, and the lesson
 * open beside it with its video, text and downloads. In preview the team sees drafts too, marked,
 * and nothing is recorded.
 */
export function CoursePlayer({
  course,
  lessonId,
  completed,
  basePath,
  mode,
  canComplete,
}: {
  course: Course;
  lessonId: string | undefined;
  completed: Set<string>;
  basePath: string;
  mode: "patient" | "preview";
  canComplete: boolean;
}) {
  const lessons = lessonsInOrder(course, { publishedOnly: mode === "patient" });
  if (lessons.length === 0) {
    return <p className="type-body">There are no lessons in this course yet.</p>;
  }
  const firstOpen = lessons.find((l) => !completed.has(l.id)) ?? lessons[0]!;
  const current = lessons.find((l) => l.id === lessonId) ?? firstOpen;
  const index = lessons.indexOf(current);
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  const done = lessons.filter((l) => completed.has(l.id)).length;
  const percent = Math.round((done / lessons.length) * 100);
  const isDone = completed.has(current.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav aria-label="Lessons" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        {mode === "patient" ? (
          <div className="flex flex-col gap-2">
            <p className="type-small text-content-muted tabular-nums">
              {done} of {lessons.length} lessons complete
            </p>
            <div className="h-1.5 w-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Course progress">
              <div className="h-full bg-secondary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}
        <ol className="flex flex-col gap-4">
          {course.sections.map((section) => {
            const inSection = lessons.filter((l) => section.modules.some((m) => m.id === l.id));
            if (inSection.length === 0) return null;
            return (
              <li key={section.id} className="flex flex-col gap-1">
                <span className="type-eyebrow text-content-muted">{section.title}</span>
                <ol className="flex flex-col">
                  {inSection.map((lesson) => {
                    const active = lesson.id === current.id;
                    const tick = completed.has(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`${basePath}?lesson=${lesson.id}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "type-body flex items-start gap-2 px-2 py-1.5 text-content no-underline hover:bg-surface-selected",
                            active && "bg-surface-selected font-medium",
                          )}
                        >
                          {tick ? (
                            <Check className="mt-1 size-4 shrink-0 text-status-success" aria-label="Complete" />
                          ) : (
                            <Circle className="mt-1 size-4 shrink-0 text-content-muted" aria-hidden />
                          )}
                          <span>
                            {lesson.title}
                            {!lesson.published ? <span className="type-small text-content-muted"> · draft</span> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
      </nav>

      <article aria-labelledby="lesson-title" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="type-eyebrow text-content-muted">
            {current.sectionTitle} · Lesson {current.number} of {lessons.length}
          </p>
          <h2 id="lesson-title" className="type-section-title">
            {current.title}
          </h2>
        </div>
        {mode === "preview" && !current.published ? (
          <Alert variant="warning">
            <AlertDescription>This lesson is a draft. Patients cannot see it until it is published.</AlertDescription>
          </Alert>
        ) : null}
        <LessonVideo url={current.videoUrl} title={current.title} />
        <LessonText content={current.content} fallback={current.body} />
        <LessonFiles files={current.files} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-6">
          {previous ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}?lesson=${previous.id}`}>
                <ArrowLeft aria-hidden />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {mode === "patient" && canComplete && !isDone ? (
            <form action={completeLesson}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="lessonId" value={current.id} />
              {next ? <input type="hidden" name="next" value={next.id} /> : null}
              <Button type="submit">
                {next ? "Mark complete and continue" : "Mark complete"}
                {next ? <ArrowRight aria-hidden /> : <Check aria-hidden />}
              </Button>
            </form>
          ) : next ? (
            <Button variant={isDone || mode === "preview" ? "primary" : "outline"} size="sm" asChild>
              <Link href={`${basePath}?lesson=${next.id}`}>
                Next lesson
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : isDone && mode === "patient" && done === lessons.length ? (
            <p className="type-body text-content-muted">You have completed this course.</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
