"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { afterChange, deliveryLine } from "@/lib/booking/follow-up";
import { stillFreeInGoogle } from "@/lib/booking/online";
import { isDay, londonInstant } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export type DiaryFormState = { error?: string; saved?: string; sentAt?: number };

/**
 * Moves a booking to another time, and optionally another clinician. The database checks the
 * clinician's hours and that nothing overlaps; the old calendar event is removed, a new one made, and
 * the patient told.
 */
export async function moveAppointment(_state: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  const parsed = z
    .object({
      appointmentId: z.uuid(),
      staffId: z.uuid("Choose a clinician."),
      day: z.string().refine(isDay, "Choose a date."),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time."),
    })
    .safeParse({ appointmentId: formData.get("appointmentId"), staffId: formData.get("staffId"), day: formData.get("day"), time: formData.get("time") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "We could not move that. Please try again." };
  if (!(await allowAuthAttempt("booking", user.email))) return { error: "Too many changes at once. Please wait a while and try again." };

  const supabase = await createClient();
  const startsAt = londonInstant(parsed.data.day, parsed.data.time);
  const [directory, length] = await Promise.all([
    supabase.rpc("get_staff_directory"),
    supabase.from("appointments").select("duration_min").eq("id", parsed.data.appointmentId).maybeSingle(),
  ]);
  const clinician = directory.data?.find((d) => d.staff_id === parsed.data.staffId);
  if (clinician && length.data && !(await stillFreeInGoogle({ staffId: clinician.staff_id, profileId: clinician.profile_id, name: clinician.full_name, jobTitle: clinician.job_title }, startsAt, length.data.duration_min))) {
    return { error: "That time is taken in the clinician's calendar. Please choose another." };
  }
  const before = await supabase
    .from("appointments")
    .select("id, external_id, clinician:staff_profiles(user_id)")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (before.error || !before.data) return { error: "You cannot move this appointment." };

  const { error } = await supabase.rpc("move_appointment", {
    _appointment: parsed.data.appointmentId,
    _staff: parsed.data.staffId,
    _starts_at: startsAt,
  });
  if (error) return { error: ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : "We could not move that. Please try again." };

  const delivery = await afterChange(parsed.data.appointmentId, "moved", {
    clinicianUserId: before.data.clinician?.user_id ?? null,
    eventId: before.data.external_id,
  });
  revalidatePath("/clinic/diary", "layout");
  return { saved: `Appointment moved. ${deliveryLine(delivery)}`, sentAt: Date.now() };
}

export type PatientMatch = { id: string; name: string; clinicRef: string; dateOfBirth: string };
export type PatientSearchState = { query?: string; results?: PatientMatch[]; error?: string };

/**
 * Finds patients the person can open, for a new booking from the diary. Sent in the form body, not
 * the address, so names stay out of logs and history. The words are reduced to letters, numbers,
 * spaces, apostrophes and hyphens, so they cannot change the filter.
 */
export async function searchPatients(_state: PatientSearchState, formData: FormData): Promise<PatientSearchState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  const raw = String(formData.get("q") ?? "").slice(0, 80);
  const term = raw.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (term.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return { query: raw, error: "Type at least two letters or numbers." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_profiles")
    .select("id, first_name, last_name, clinic_ref, date_of_birth")
    .is("archived_at", null)
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,clinic_ref.ilike.%${term}%`)
    .order("last_name")
    .limit(25);
  if (error) return { query: raw, error: "We could not search. Please try again." };
  return { query: raw, results: data.map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, clinicRef: p.clinic_ref, dateOfBirth: p.date_of_birth })) };
}
