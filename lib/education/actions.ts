"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { randomUUID } from "node:crypto";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getPortalPatientId } from "@/lib/data/education";
import { cleanLessonDoc } from "@/lib/education/content";
import { extensionFor, fileKind, MAX_FILE_BYTES } from "@/lib/files";
import { getMyStaffId } from "@/lib/data/patient-record";
import { createClient } from "@/lib/supabase/server";

export type EducationFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not save that. Please try again.";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isAdmin) redirect("/clinic");
  const staffId = await getMyStaffId(user.id);
  if (!staffId) redirect("/clinic");
  return { user, staffId };
}

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  const staffId = await getMyStaffId(user.id);
  if (!staffId) redirect("/clinic");
  return { user, staffId };
}

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

const title = z.string().trim().min(1, "Add a title.").max(200, "Use 200 characters or fewer for the title.");

export async function createCourse(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  const { staffId } = await requireAdmin();
  const parsed = z
    .object({ title, description: z.string().trim().max(4000).optional() })
    .safeParse({ title: text(formData, "title"), description: text(formData, "description") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_courses")
    .insert({ title: parsed.data.title, description: parsed.data.description ?? null, created_by: staffId })
    .select("id")
    .single();
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/education");
  redirect(`/clinic/education/${data.id}`);
}

export async function updateCourse(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({ courseId: z.uuid(), title, description: z.string().trim().max(4000).optional(), published: z.boolean() })
    .safeParse({
      courseId: text(formData, "courseId"),
      title: text(formData, "title"),
      description: text(formData, "description") || undefined,
      published: formData.get("published") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase
    .from("education_courses")
    .update({ title: parsed.data.title, description: parsed.data.description ?? null, published: parsed.data.published })
    .eq("id", parsed.data.courseId);
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`);
  revalidatePath("/clinic/education");
  return { saved: parsed.data.published ? "Saved. Patients it is assigned to can see it." : "Saved as a draft. Patients cannot see it yet." };
}

export async function addSection(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z.object({ courseId: z.uuid(), title, position: z.coerce.number().int().min(0).max(1000) }).safeParse({
    courseId: text(formData, "courseId"),
    title: text(formData, "title"),
    position: text(formData, "position") ?? "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase
    .from("education_sections")
    .insert({ course_id: parsed.data.courseId, title: parsed.data.title, position: parsed.data.position });
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`);
  return { saved: "Section added." };
}

/** Archives a section or a module; it disappears from patients' portals. */
export async function archivePart(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({ courseId: z.uuid(), id: z.uuid(), kind: z.enum(["section", "module"]) })
    .safeParse({ courseId: text(formData, "courseId"), id: text(formData, "id"), kind: text(formData, "kind") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const table = parsed.data.kind === "section" ? "education_sections" : "education_modules";
  const { error } = await supabase.from(table).update({ archived_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  revalidatePath("/portal/education", "layout");
  return { saved: "Removed." };
}

/** Puts a course on a patient's portal. Row-level security limits it to patients the person can open. */
export async function assignCourse(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  const { staffId } = await requireStaff();
  const parsed = z
    .object({ patientId: z.uuid(), courseId: z.uuid("Choose a course.") })
    .safeParse({ patientId: text(formData, "patientId"), courseId: text(formData, "courseId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase
    .from("education_assignments")
    .insert({ patient_id: parsed.data.patientId, course_id: parsed.data.courseId, assigned_by: staffId });
  if (error) return { error: error.code === "23505" ? "This course is already on the patient's portal." : GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Course added to the patient's portal." };
}

export async function unassignCourse(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireStaff();
  const parsed = z
    .object({ patientId: z.uuid(), assignmentId: z.uuid() })
    .safeParse({ patientId: text(formData, "patientId"), assignmentId: text(formData, "assignmentId") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.assignmentId)
    .select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Course taken off the patient's portal." };
}

const lessonTitle = z.string().trim().min(1, "Give the lesson a title.").max(200, "Use 200 characters or fewer for the title.");

/** Replaces a course's cover image. The old image is kept in storage, as nothing is deleted. */
export async function uploadCover(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  const { user } = await requireAdmin();
  const courseId = z.uuid().safeParse(text(formData, "courseId"));
  if (!courseId.success) return { error: GENERIC_FAILURE };
  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (file.size > 5 * 1024 * 1024) return { error: "That image is over 5 MB. Choose a smaller one." };
  if (!(await allowAuthAttempt("document-upload", user.email))) return { error: "Too many uploads at once. Please wait a while and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileKind(bytes);
  if (type !== "image/png" && type !== "image/jpeg") return { error: "Use a JPEG or PNG image." };
  const supabase = await createClient();
  const path = `courses/${courseId.data}/cover-${randomUUID()}.${extensionFor(type)}`;
  const upload = await supabase.storage.from("education").upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) return { error: "The image could not be saved. Please try again." };
  const { error } = await supabase.from("education_courses").update({ cover_path: path }).eq("id", courseId.data);
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${courseId.data}`, "layout");
  revalidatePath("/clinic/education");
  revalidatePath("/portal/education", "layout");
  return { saved: "Cover image saved." };
}

export async function renameSection(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({ courseId: z.uuid(), sectionId: z.uuid(), title })
    .safeParse({ courseId: text(formData, "courseId"), sectionId: text(formData, "sectionId"), title: text(formData, "title") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("education_sections").update({ title: parsed.data.title }).eq("id", parsed.data.sectionId);
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  return { saved: "Section renamed." };
}

/** Adds a draft lesson at the end of a section and opens it in the editor. */
export async function addLesson(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({ courseId: z.uuid(), sectionId: z.uuid(), title: lessonTitle })
    .safeParse({ courseId: text(formData, "courseId"), sectionId: text(formData, "sectionId"), title: text(formData, "title") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const last = await supabase
    .from("education_modules")
    .select("position")
    .eq("section_id", parsed.data.sectionId)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last.data?.[0]?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("education_modules")
    .insert({ section_id: parsed.data.sectionId, title: parsed.data.title, position, published: false, content: { type: "doc", content: [] } })
    .select("id")
    .single();
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  redirect(`/clinic/education/${parsed.data.courseId}/lessons/${data.id}`);
}

/** Saves a lesson from the editor: title, video, text and whether patients can see it. */
export async function saveLesson(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({
      courseId: z.uuid(),
      lessonId: z.uuid(),
      title: lessonTitle,
      videoUrl: z.url({ protocol: /^https$/, error: "Use a video link that starts with https://" }).max(2000).optional(),
      content: z.string().max(400_000, "The lesson text is too long."),
      published: z.boolean(),
    })
    .safeParse({
      courseId: text(formData, "courseId"),
      lessonId: text(formData, "lessonId"),
      title: text(formData, "title"),
      videoUrl: text(formData, "videoUrl")?.trim() || undefined,
      content: text(formData, "content") ?? "",
      published: formData.get("published") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  let raw: unknown;
  try {
    raw = JSON.parse(parsed.data.content || '{"type":"doc","content":[]}');
  } catch {
    return { error: "The lesson text could not be read. Please try again." };
  }
  const content = cleanLessonDoc(raw);
  if (!content) return { error: "The lesson text is too long." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_modules")
    .update({ title: parsed.data.title, video_url: parsed.data.videoUrl ?? null, content, published: parsed.data.published })
    .eq("id", parsed.data.lessonId)
    .select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  revalidatePath("/portal/education", "layout");
  return { saved: parsed.data.published ? "Saved and published." : "Saved as a draft. Patients cannot see it yet." };
}

type Outline = { section: string; lessons: string[] }[];

async function readOutline(courseId: string): Promise<Outline | null> {
  const supabase = await createClient();
  const sections = await supabase
    .from("education_sections")
    .select("id")
    .eq("course_id", courseId)
    .is("archived_at", null)
    .order("position")
    .order("created_at");
  if (sections.error) return null;
  const ids = sections.data.map((s) => s.id);
  const lessons = ids.length
    ? await supabase
        .from("education_modules")
        .select("id, section_id")
        .in("section_id", ids)
        .is("archived_at", null)
        .order("position")
        .order("created_at")
    : { data: [], error: null };
  if (lessons.error) return null;
  return ids.map((id) => ({ section: id, lessons: (lessons.data ?? []).filter((l) => l.section_id === id).map((l) => l.id) }));
}

/**
 * Moves a section, or a lesson, one place up or down. A lesson at the top or bottom of its section
 * moves into the section before or after.
 */
export async function moveItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ courseId: z.uuid(), id: z.uuid(), kind: z.enum(["section", "lesson"]), direction: z.enum(["up", "down"]) })
    .safeParse({ courseId: text(formData, "courseId"), id: text(formData, "id"), kind: text(formData, "kind"), direction: text(formData, "direction") });
  if (!parsed.success) return;
  const { courseId, id, kind, direction } = parsed.data;
  const outline = await readOutline(courseId);
  if (!outline) return;
  const step = direction === "up" ? -1 : 1;

  if (kind === "section") {
    const index = outline.findIndex((s) => s.section === id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= outline.length) return;
    [outline[index], outline[target]] = [outline[target]!, outline[index]!];
  } else {
    const sectionIndex = outline.findIndex((s) => s.lessons.includes(id));
    if (sectionIndex < 0) return;
    const lessons = outline[sectionIndex]!.lessons;
    const index = lessons.indexOf(id);
    const target = index + step;
    if (target >= 0 && target < lessons.length) {
      [lessons[index], lessons[target]] = [lessons[target]!, lessons[index]!];
    } else {
      const next = outline[sectionIndex + step];
      if (!next) return;
      lessons.splice(index, 1);
      if (step < 0) next.lessons.push(id);
      else next.lessons.unshift(id);
    }
  }
  const supabase = await createClient();
  await supabase.rpc("reorder_course", { _course: courseId, _order: outline });
  revalidatePath(`/clinic/education/${courseId}`, "layout");
  revalidatePath("/portal/education", "layout");
}

/** Attaches a PDF handout or an image to a lesson. */
export async function uploadLessonFile(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  const { user, staffId } = await requireAdmin();
  const parsed = z.object({ courseId: z.uuid(), lessonId: z.uuid() }).safeParse({ courseId: text(formData, "courseId"), lessonId: text(formData, "lessonId") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 10 MB. Choose a smaller one." };
  if (!(await allowAuthAttempt("document-upload", user.email))) return { error: "Too many uploads at once. Please wait a while and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileKind(bytes);
  if (!type) return { error: "Use a PDF, JPEG or PNG file." };
  const name = (file.name || "File").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "File";
  const supabase = await createClient();
  const id = randomUUID();
  const path = `files/${parsed.data.lessonId}/${id}.${extensionFor(type)}`;
  const upload = await supabase.storage.from("education").upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) return { error: "The file could not be saved. Please try again." };
  const { error } = await supabase.from("education_files").insert({
    module_id: parsed.data.lessonId,
    storage_path: path,
    file_name: name,
    content_type: type,
    size_bytes: file.size,
    created_by: staffId,
  });
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  revalidatePath("/portal/education", "layout");
  return { saved: "File added." };
}

export async function archiveLessonFile(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z.object({ courseId: z.uuid(), fileId: z.uuid() }).safeParse({ courseId: text(formData, "courseId"), fileId: text(formData, "fileId") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("education_files").update({ archived_at: new Date().toISOString() }).eq("id", parsed.data.fileId).select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`, "layout");
  revalidatePath("/portal/education", "layout");
  return { saved: "File removed." };
}

/**
 * A patient, or a guardian who can act, marks a lesson complete and moves on to the next one.
 * Completing a lesson twice changes nothing.
 */
export async function completeLesson(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = z
    .object({ courseId: z.uuid(), lessonId: z.uuid(), next: z.uuid().optional() })
    .safeParse({ courseId: text(formData, "courseId"), lessonId: text(formData, "lessonId"), next: text(formData, "next") || undefined });
  if (!parsed.success) redirect("/portal/education");
  const patient = await getPortalPatientId();
  if (!patient || !patient.canAct || user.isSuspended) redirect(`/portal/education/${parsed.data.courseId}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("education_progress")
    .insert({ patient_id: patient.id, module_id: parsed.data.lessonId, completed_by: user.id });
  if (error && error.code !== "23505") redirect(`/portal/education/${parsed.data.courseId}?lesson=${parsed.data.lessonId}&saved=0`);
  revalidatePath("/portal/education", "layout");
  redirect(`/portal/education/${parsed.data.courseId}?lesson=${parsed.data.next ?? parsed.data.lessonId}`);
}
