"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
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

export async function addModule(_state: EducationFormState, formData: FormData): Promise<EducationFormState> {
  await requireAdmin();
  const parsed = z
    .object({
      courseId: z.uuid(),
      sectionId: z.uuid(),
      title,
      body: z.string().trim().max(20000, "The text is too long.").optional(),
      videoUrl: z.url({ protocol: /^https$/, error: "Use a video link that starts with https://" }).max(2000).optional(),
      position: z.coerce.number().int().min(0).max(1000),
    })
    .safeParse({
      courseId: text(formData, "courseId"),
      sectionId: text(formData, "sectionId"),
      title: text(formData, "title"),
      body: text(formData, "body") || undefined,
      videoUrl: text(formData, "videoUrl") || undefined,
      position: text(formData, "position") ?? "0",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("education_modules").insert({
    section_id: parsed.data.sectionId,
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    video_url: parsed.data.videoUrl ?? null,
    position: parsed.data.position,
  });
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/education/${parsed.data.courseId}`);
  return { saved: "Module added." };
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
  revalidatePath(`/clinic/education/${parsed.data.courseId}`);
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
