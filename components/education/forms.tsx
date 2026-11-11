"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addModule,
  addSection,
  archivePart,
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

export function ModuleForm({ courseId, sectionId, nextPosition }: { courseId: string; sectionId: string; nextPosition: number }) {
  const [state, action, pending] = useActionState(addModule, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="position" value={nextPosition} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`module-title-${sectionId}`}>Module title</Label>
        <Input id={`module-title-${sectionId}`} name="title" maxLength={200} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`module-video-${sectionId}`}>Video link (optional)</Label>
        <Input id={`module-video-${sectionId}`} name="videoUrl" type="url" placeholder="https://" maxLength={2000} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`module-body-${sectionId}`}>Text (optional)</Label>
        <Textarea id={`module-body-${sectionId}`} name="body" maxLength={20000} />
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="outline" size="sm" loading={pending}>
          Add module
        </Button>
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
      <Button type="submit" variant="ghost" size="sm" loading={pending} aria-label={`Remove ${label}`}>
        Remove
      </Button>
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
