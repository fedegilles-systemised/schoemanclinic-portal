import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DiaryEntry = {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  type: string;
  status: string;
  clinicianId: string | null;
  locationId: string | null;
  patientId: string;
  patientName: string;
  clinicRef: string;
  canOpen: boolean;
  bookedOnline: boolean;
  newPatient: boolean;
};

export type DiaryClinician = { staffId: string; profileId: string; name: string; role: string };
export type DiaryLocation = { id: string; name: string };

/** Every clinician's bookings between two instants (at most six weeks), cancelled ones left out. */
export async function getDiary(fromIso: string, toIso: string): Promise<DiaryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clinic_diary", { _from: fromIso, _to: toIso });
  if (error) throw new Error("Could not load the diary.");
  return data.map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    endsAt: new Date(Date.parse(r.starts_at) + r.duration_min * 60000).toISOString(),
    durationMin: r.duration_min,
    type: r.type,
    status: r.status,
    clinicianId: r.clinician_id,
    locationId: r.location_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    clinicRef: r.clinic_ref,
    canOpen: r.can_open,
    bookedOnline: r.booked_online,
    newPatient: r.new_patient,
  }));
}

/** The people who can be booked (doctors, nurses and health coaches) and the clinic's places. */
export async function getDiaryPeople(): Promise<{ clinicians: DiaryClinician[]; locations: DiaryLocation[] }> {
  const supabase = await createClient();
  const [directory, locations] = await Promise.all([supabase.rpc("get_staff_directory"), supabase.from("locations").select("id, name").order("name")]);
  if (directory.error || locations.error) throw new Error("Could not load the team.");
  return {
    clinicians: directory.data
      .filter((d) => d.clinical_role === "doctor" || d.clinical_role === "nurse" || d.clinical_role === "health_coach")
      .map((d) => ({ staffId: d.staff_id, profileId: d.profile_id, name: d.full_name, role: d.clinical_role }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    locations: locations.data.map((l) => ({ id: l.id, name: l.name })),
  };
}
