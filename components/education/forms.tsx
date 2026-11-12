"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LessonVideo } from "@/components/education/lesson-content";
import { RichTextEditor } from "@/components/education/rich-text-editor";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  addLesson,
  addSection,
  archiveLessonFile,
  archivePart,
  renameSection,
  saveLesson,
  uploadCover,
  uploadLessonFile,
  assignCourse,
  createCourse,
  unassignCourse,
  updateCourse,
  type EducationFormState,
} from "@/lib/education/actions";

const initial: EducationFormState = {};

export function CreateCourseForm() {
  const [state, action, pending] = useActionState(createCourse, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-title">Course title</Label>
        <Input id="course-title" name="title" maxLength={200} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-description">Short description (optional)</Label>
        <Textarea id="course-description" name="description" maxLength={4000} />
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Create course
        </Button>
      </div>
    </form>
  );
}

export function EditCourseForm({ courseId, title, description, published }: { courseId: string; title: string; description: string | null; published: boolean }) {
  const [state, action, pending] = useActionState(updateCourse, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-title">Course title</Label>
        <Input id="edit-title" name="title" defaultValue={title} maxLength={200} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-description">Short description (optional)</Label>
        <Textarea id="edit-description" name="description" defaultValue={description ?? ""} maxLength={4000} />
      </div>
      <label className="type-body flex items-center gap-2">
        <input type="checkbox" name="published" defaultChecked={published} />
        Published: patients it is assigned to can see it
      </label>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save course
        </Button>
      </div>
    </form>
  );
}

export function SectionForm({ courseId, nextPosition }: { courseId: string; nextPosition: number }) {
  const [state, action, pending] = useActionState(addSection, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="position" value={nextPosition} />
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="section-title">New section</Label>
        <Input id="section-title" name="title" maxLength={200} required />
      </div>
      <Button type="submit" variant="outline" loading={pending}>
        Add section
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ArchivePartButton({ courseId, id, kind, label }: { courseId: string; id: string; kind: "section" | "module"; label: string }) {
  const [state, action, pending] = useActionState(archivePart, initial);
  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <ConfirmButton
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`Remove ${label}`}
        confirmTitle={`Remove ${kind === "section" ? "this section" : "this lesson"}?`}
        confirmText={
          kind === "section"
            ? "It disappears from the course for the team and for patients, with its lessons. It is kept in the clinic's records."
            : "It disappears from the course for the team and for patients. It is kept in the clinic's records."
        }
      >
        Remove
      </ConfirmButton>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function AssignCourseForm({ patientId, courses }: { patientId: string; courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(assignCourse, initial);
  if (courses.length === 0) return <p className="type-small text-content-muted">No published courses yet.</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor="assign-course">Add a course to their portal</Label>
        <Select id="assign-course" name="courseId" required defaultValue="">
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="outline" loading={pending}>
        Add course
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function UnassignButton({ patientId, assignmentId, title }: { patientId: string; assignmentId: string; title: string }) {
  const [state, action, pending] = useActionState(unassignCourse, initial);
  return (
    <form action={action}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Take ${title} off the portal`}>
        Remove
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

/** The cover image of a course: JPEG or PNG, up to 5 MB. */
export function CoverForm({ courseId, hasCover }: { courseId: string; hasCover: boolean }) {
  const [state, action, pending] = useActionState(uploadCover, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cover">{hasCover ? "Replace the cover image" : "Cover image"}</Label>
        <input id="cover" name="cover" type="file" accept="image/png,image/jpeg" required className="type-small" />
        <p className="type-small text-content-muted">A wide JPEG or PNG works best, about 1600 by 900 pixels. Up to 5 MB.</p>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="outline" size="sm" loading={pending}>
          Upload image
        </Button>
      </div>
    </form>
  );
}

/** Renames a section in place. */
export function RenameSectionForm({ courseId, sectionId, title }: { courseId: string; sectionId: string; title: string }) {
  const [state, action, pending] = useActionState(renameSection, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor={`section-name-${sectionId}`}>Section name</Label>
        <Input id={`section-name-${sectionId}`} name="title" defaultValue={title} maxLength={200} required />
      </div>
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Rename
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Adds a lesson to a section, as a draft, and opens it in the editor. */
export function AddLessonForm({ courseId, sectionId }: { courseId: string; sectionId: string }) {
  const [state, action, pending] = useActionState(addLesson, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor={`new-lesson-${sectionId}`}>New lesson</Label>
        <Input id={`new-lesson-${sectionId}`} name="title" maxLength={200} placeholder="Lesson title" required />
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Add lesson
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/**
 * The lesson editor: title, video link with a live preview, formatted text, and whether patients
 * can see it.
 */
export function LessonEditorForm({
  courseId,
  lessonId,
  title,
  videoUrl,
  content,
  published,
}: {
  courseId: string;
  lessonId: string;
  title: string;
  videoUrl: string | null;
  content: unknown;
  published: boolean;
}) {
  const [state, action, pending] = useActionState(saveLesson, initial);
  const [video, setVideo] = useState(videoUrl ?? "");
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lesson-title">Lesson title</Label>
        <Input id="lesson-title" name="title" defaultValue={title} maxLength={200} required />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lesson-video">Video link (optional)</Label>
          <Input
            id="lesson-video"
            name="videoUrl"
            type="url"
            placeholder="A YouTube, Vimeo or Loom link"
            maxLength={2000}
            value={video}
            onChange={(event) => setVideo(event.target.value)}
          />
          <p className="type-small text-content-muted">Paste the link to the video. Unlisted YouTube and private Vimeo links work too.</p>
        </div>
        {video.startsWith("https://") ? <LessonVideo url={video} title={title} /> : null}
      </div>
      <RichTextEditor name="content" initial={content} label="Lesson text" />
      <label className="type-body flex items-center gap-2">
        <input type="checkbox" name="published" defaultChecked={published} className="size-4 accent-secondary" />
        Published: patients given this course can see this lesson
      </label>
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Save lesson
        </Button>
      </div>
    </form>
  );
}

/** Attaches a PDF handout or an image to a lesson. */
export function LessonFileForm({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [state, action, pending] = useActionState(uploadLessonFile, initial);
  return (
    <form action={action} className="flex flex-col gap-3" key={state.saved ?? "file"}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lesson-file">Add a file</Label>
        <input id="lesson-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required className="type-small" />
        <p className="type-small text-content-muted">A PDF, JPEG or PNG, up to 10 MB. Patients can open it from the lesson.</p>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="outline" size="sm" loading={pending}>
          Upload file
        </Button>
      </div>
    </form>
  );
}

export function ArchiveFileButton({ courseId, fileId, name }: { courseId: string; fileId: string; name: string }) {
  const [state, action, pending] = useActionState(archiveLessonFile, initial);
  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="fileId" value={fileId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Remove ${name}`}>
        Remove
      </Button>
      {state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
