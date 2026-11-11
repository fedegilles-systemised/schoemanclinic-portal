import "server-only";

import { getPortalPatient } from "@/lib/portal/patient";
import { createClient } from "@/lib/supabase/server";
import type { WearableMetric } from "@/lib/wearables/metrics";

export type CourseSummary = { id: string; title: string; description: string | null; published: boolean; moduleCount: number };
export type CourseModule = { id: string; title: string; body: string | null; videoUrl: string | null; position: number };
export type CourseSection = { id: string; title: string; position: number; modules: CourseModule[] };
export type Course = CourseSummary & { sections: CourseSection[] };

/** The library for staff, or the courses on the signed-in patient's portal: row-level security decides. */
export async function listCourses(): Promise<CourseSummary[]> {
  const supabase = await createClient();
  const [courses, sections, modules] = await Promise.all([
    supabase.from("education_courses").select("id, title, description, published").is("archived_at", null).order("title"),
    supabase.from("education_sections").select("id, course_id").is("archived_at", null),
    supabase.from("education_modules").select("id, section_id").is("archived_at", null),
  ]);
  if (courses.error || sections.error || modules.error) throw new Error("Could not load the courses.");
  const courseOf = new Map(sections.data.map((s) => [s.id, s.course_id]));
  const counts = new Map<string, number>();
  for (const m of modules.data) {
    const course = courseOf.get(m.section_id);
    if (course) counts.set(course, (counts.get(course) ?? 0) + 1);
  }
  return courses.data.map((c) => ({ ...c, moduleCount: counts.get(c.id) ?? 0 }));
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const supabase = await createClient();
  const course = await supabase
    .from("education_courses")
    .select("id, title, description, published")
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
        .select("id, section_id, title, body, video_url, position")
        .in("section_id", ids)
        .is("archived_at", null)
        .order("position")
        .order("created_at")
    : { data: [], error: null };
  if (modules.error) throw new Error("Could not load the course.");
  const sectionList: CourseSection[] = sections.data.map((s) => ({
    ...s,
    modules: (modules.data ?? [])
      .filter((m) => m.section_id === s.id)
      .map((m) => ({ id: m.id, title: m.title, body: m.body, videoUrl: m.video_url, position: m.position })),
  }));
  return { ...course.data, moduleCount: sectionList.reduce((n, s) => n + s.modules.length, 0), sections: sectionList };
}

export type Assignment = { id: string; courseId: string; title: string; published: boolean };

/** The courses assigned to one patient, for the clinic's record page. */
export async function getPatientAssignments(patientId: string): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_assignments")
    .select("id, course_id, course:education_courses(title, published)")
    .eq("patient_id", patientId)
    .is("archived_at", null);
  if (error) throw new Error("Could not load the patient's courses.");
  return data.map((a) => ({ id: a.id, courseId: a.course_id, title: a.course?.title ?? "A course", published: a.course?.published ?? false }));
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
