import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AppointmentRow = {
  id: string;
  startsAt: string;
  durationMin: number;
  type: string;
  status: string;
  clinicianName: string | null;
  locationName: string | null;
};

/** One patient's appointments from today on, earliest first. Row-level security decides who may read them. */
export async function getUpcomingAppointments(patientId: string): Promise<AppointmentRow[]> {
  const supabase = await createClient();
  const [appointments, directory, locations] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, duration_min, type, status, clinician_id, location_id")
      .eq("patient_id", patientId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at"),
    supabase.rpc("get_staff_directory"),
    supabase.from("locations").select("id, name"),
  ]);
  if (appointments.error || directory.error || locations.error) throw new Error("Could not load the appointments.");
  const names = new Map(directory.data.map((d) => [d.staff_id, d.full_name]));
  const places = new Map(locations.data.map((l) => [l.id, l.name]));
  return appointments.data.map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    durationMin: a.duration_min,
    type: a.type,
    status: a.status,
    clinicianName: a.clinician_id ? (names.get(a.clinician_id) ?? null) : null,
    locationName: a.location_id ? (places.get(a.location_id) ?? null) : null,
  }));
}

export type BookingOptions = {
  types: { id: string; name: string; durationMin: number; locationKind: string }[];
  clinicians: { staffId: string; profileId: string; name: string; role: string }[];
};

/**
 * What can be booked for a patient. A patient or guardian sees the types open to patients and the
 * clinicians on their care team; staff see every active type and every clinician.
 */
export async function getBookingOptions(patientId: string, asPatient: boolean): Promise<BookingOptions> {
  const supabase = await createClient();
  let types = supabase.from("appointment_types").select("id, name, duration_min, location_kind").eq("active", true).order("name");
  if (asPatient) types = types.eq("bookable_by_patients", true);
  const [typeRows, clinicians] = await Promise.all([
    types,
    asPatient ? supabase.rpc("get_bookable_clinicians", { _patient: patientId }) : supabase.rpc("get_staff_directory"),
  ]);
  if (typeRows.error || clinicians.error) throw new Error("Could not load the booking options.");
  return {
    types: typeRows.data.map((t) => ({ id: t.id, name: t.name, durationMin: t.duration_min, locationKind: t.location_kind })),
    clinicians: clinicians.data
      .filter((c) => c.clinical_role === "doctor" || c.clinical_role === "nurse" || c.clinical_role === "health_coach")
      .map((c) => ({ staffId: c.staff_id, profileId: c.profile_id, name: c.full_name, role: c.clinical_role })),
  };
}
