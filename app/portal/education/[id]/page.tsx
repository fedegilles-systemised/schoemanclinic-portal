import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCourse, getPortalCourseIds } from "@/lib/data/education";

export const metadata: Metadata = { title: "Course · The Schoeman Clinic" };

export default async function PortalCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Row-level security returns the course only if it is published and on this person's portal.
  const [course, mine] = await Promise.all([getCourse(id), getPortalCourseIds()]);
  if (!course || !course.published || !mine.has(course.id)) notFound();

  return (
    <>
      <Link href="/portal/education" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Your courses
      </Link>
      <PageHeader eyebrow="Course" title={`${course.title} `} description={course.description ?? undefined} />
      <div className="flex flex-col gap-10">
        {course.sections.map((section) => (
          <section key={section.id} aria-labelledby={`section-${section.id}`} className="flex flex-col gap-4">
            <h2 id={`section-${section.id}`} className="type-section-title">
              {section.title}
            </h2>
            {section.modules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <CardTitle>{module.title}</CardTitle>
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
          </section>
        ))}
      </div>
    </>
  );
}
