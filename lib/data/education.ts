import "server-only";

import { getPortalPatient } from "@/lib/portal/patient";
import { createClient } from "@/lib/supabase/server";
import type { WearableMetric } from "@/lib/wearables/metrics";

export type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  moduleCount: number;
  coverUrl: string | null;
  /** The ids of the lessons the reader can see, for progress. */
  lessonIds: string[];
};
export type LessonFile = { id: string; name: string; contentType: string; sizeBytes: number; url: string | null };
export type CourseModule = {
  id: string;
  title: string;
  body: string | null;
  content: unknown;
  videoUrl: string | null;
  position: number;
  published: boolean;
  files: LessonFile[];
};
export type CourseSection = { id: string; title: string; position: number; modules: CourseModule[] };
export type Course = CourseSummary & { sections: CourseSection[] };

/** Signed links last an hour: long enough to watch a lesson and open its handouts. */
const SIGNED_SECONDS = 60 * 60;

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("education").createSignedUrls(paths, SIGNED_SECONDS);
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

/**
 * The library for staff, or the courses on the signed-in patient's portal: row-level security
 * decides. Lesson counts include drafts for staff; patients only ever see published lessons.
 */
export async function listCourses(): Promise<CourseSummary[]> {
  const supabase = await createClient();
  const [courses, sections, modules] = await Promise.all([
    supabase.from("education_courses").select("id, title, description, published, cover_path").is("archived_at", null).order("title"),
    supabase.from("education_sections").select("id, course_id").is("archived_at", null),
    supabase.from("education_modules").select("id, section_id").is("archived_at", null),
  ]);
  if (courses.error || sections.error || modules.error) throw new Error("Could not load the courses.");
  const courseOf = new Map(sections.data.map((s) => [s.id, s.course_id]));
  const lessonsOf = new Map<string, string[]>();
  for (const m of modules.data) {
    const course = courseOf.get(m.section_id);
    if (course) lessonsOf.set(course, [...(lessonsOf.get(course) ?? []), m.id]);
  }
  const covers = await signedUrls(courses.data.flatMap((c) => (c.cover_path ? [c.cover_path] : [])));
  return courses.data.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    published: c.published,
    moduleCount: lessonsOf.get(c.id)?.length ?? 0,
    coverUrl: c.cover_path ? (covers.get(c.cover_path) ?? null) : null,
    lessonIds: lessonsOf.get(c.id) ?? [],
  }));
}

/** One course with its sections, lessons and their files, in order. */
export async function getCourse(courseId: string): Promise<Course | null> {
  const supabase = await createClient();
  const course = await supabase
    .from("education_courses")
    .select("id, title, description, published, cover_path")
    .eq("id", courseId)
    .is("archived_at", null)
    .maybeSingle();
  if (course.error) throw new Error("Could not load the course.");
  if (!course.data) return null;
  const sections = await supabase
    .from("education_sections")
    .select("id, title, position")
    .eq("course_id", courseId)
    .is("archived_at", null)
    .order("position")
    .order("created_at");
  if (sections.error) throw new Error("Could not load the course.");
  const ids = sections.data.map((s) => s.id);
  const modules = ids.length
    ? await supabase
        .from("education_modules")
        .select("id, section_id, title, body, content, video_url, position, published")
        .in("section_id", ids)
        .is("archived_at", null)
        .order("position")
        .order("created_at")
    : { data: [], error: null };
  if (modules.error) throw new Error("Could not load the course.");
  const moduleIds = (modules.data ?? []).map((m) => m.id);
  const files = moduleIds.length
    ? await supabase
        .from("education_files")
        .select("id, module_id, storage_path, file_name, content_type, size_bytes")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("created_at")
    : { data: [], error: null };
  if (files.error) throw new Error("Could not load the course.");
  const urls = await signedUrls([...(course.data.cover_path ? [course.data.cover_path] : []), ...(files.data ?? []).map((f) => f.storage_path)]);

  const sectionList: CourseSection[] = sections.data.map((s) => ({
    ...s,
    modules: (modules.data ?? [])
      .filter((m) => m.section_id === s.id)
      .map((m) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        content: m.content,
        videoUrl: m.video_url,
        position: m.position,
        published: m.published,
        files: (files.data ?? [])
          .filter((f) => f.module_id === m.id)
          .map((f) => ({ id: f.id, name: f.file_name, contentType: f.content_type, sizeBytes: f.size_bytes, url: urls.get(f.storage_path) ?? null })),
      })),
  }));
  return {
    id: course.data.id,
    title: course.data.title,
    description: course.data.description,
    published: course.data.published,
    coverUrl: course.data.cover_path ? (urls.get(course.data.cover_path) ?? null) : null,
    moduleCount: sectionList.reduce((n, s) => n + s.modules.length, 0),
    lessonIds: sectionList.flatMap((s) => s.modules.map((m) => m.id)),
    sections: sectionList,
  };
}

/** The lessons a patient has completed, as a set of lesson ids. */
export async function getCompletedLessons(patientId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("education_progress").select("module_id").eq("patient_id", patientId);
  if (error) return new Set();
  return new Set(data.map((row) => row.module_id));
}

export type Assignment = { id: string; courseId: string; title: string; published: boolean; completed: number; total: number };

/** The courses assigned to one patient, with how far they have got, for the clinic's record page. */
export async function getPatientAssignments(patientId: string): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_assignments")
    .select("id, course_id, course:education_courses(title, published)")
    .eq("patient_id", patientId)
    .is("archived_at", null);
  if (error) throw new Error("Could not load the patient's courses.");
  const courseIds = data.map((a) => a.course_id);
  const [lessons, done] = await Promise.all([
    courseIds.length
      ? supabase
          .from("education_modules")
          .select("id, section:education_sections!inner(course_id, archived_at)")
          .eq("published", true)
          .is("archived_at", null)
          .is("section.archived_at", null)
          .in("section.course_id", courseIds)
      : Promise.resolve({ data: [] as { id: string; section: { course_id: string } | null }[], error: null }),
    getCompletedLessons(patientId),
  ]);
  const byCourse = new Map<string, string[]>();
  for (const lesson of lessons.data ?? []) {
    const course = lesson.section?.course_id;
    if (course) byCourse.set(course, [...(byCourse.get(course) ?? []), lesson.id]);
  }
  return data.map((a) => {
    const ids = byCourse.get(a.course_id) ?? [];
    return {
      id: a.id,
      courseId: a.course_id,
      title: a.course?.title ?? "A course",
      published: a.course?.published ?? false,
      total: ids.length,
      completed: ids.filter((id) => done.has(id)).length,
    };
  });
}

export type Reading = { id: string; metric: WearableMetric; value: number; measuredOn: string; device: string | null; enteredBy: string };

/** Wearable readings for one patient, newest first. */
export async function getReadings(patientId: string, limit = 60): Promise<Reading[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wearable_readings")
    .select("id, metric, value, measured_on, device, entered_by")
    .eq("patient_id", patientId)
    .is("archived_at", null)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load the readings.");
  return data.map((r) => ({ id: r.id, metric: r.metric, value: Number(r.value), measuredOn: r.measured_on, device: r.device, enteredBy: r.entered_by }));
}

/** The patient the portal is showing: the one chosen in the switcher, else their own record, else the first they look after. */
export async function getPortalPatientId(): Promise<{ id: string; canAct: boolean; firstName: string } | null> {
  const record = await getPortalPatient();
  return record ? { id: record.id, canAct: record.can_act, firstName: record.first_name } : null;
}

/**
 * The courses on the portal patient's own page: published, assigned to them, not taken away.
 * Filtered explicitly as well as by row-level security, because a team member who is also a
 * patient can read the whole library.
 */
export async function getPortalCourseIds(): Promise<Set<string>> {
  const patient = await getPortalPatientId();
  if (!patient) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_assignments")
    .select("course_id")
    .eq("patient_id", patient.id)
    .is("archived_at", null);
  if (error) throw new Error("Could not load your courses.");
  return new Set(data.map((row) => row.course_id));
}
