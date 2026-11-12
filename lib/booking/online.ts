import "server-only";

import { computeSlots, type DaySlots } from "@/lib/booking/slots";
import { GoogleDisconnectedError, googleSessionFor, listEvents } from "@/lib/calendar/google";
import { addDays, londonInstant, todayInLondon } from "@/lib/calendar/time";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reads for the public booking page, which has no signed-in person. They go through the server's own
 * access, and only to what anyone may see: the types offered online, the clinicians' names and job
 * titles, and when they are free. Nothing about any patient.
 */

export type OnlineType = { id: string; name: string; durationMin: number; locationKind: "clinic" | "video"; description: string | null };
export type OnlineClinician = { staffId: string; profileId: string; name: string; jobTitle: string };
export type OnlineSlot = { startsAt: string; locationId: string | null; staffId: string };
export type OnlineDay = { day: string; slots: OnlineSlot[] };

export async function getOnlineTypes(): Promise<OnlineType[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointment_types")
    .select("id, name, duration_min, location_kind, description")
    .eq("active", true)
    .eq("bookable_online", true)
    .order("name");
  if (error) throw new Error("Could not load the appointments.");
  return data.map((t) => ({ id: t.id, name: t.name, durationMin: t.duration_min, locationKind: t.location_kind, description: t.description }));
}

export async function getOnlineClinicians(): Promise<OnlineClinician[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("online_booking_clinicians");
  if (error) throw new Error("Could not load the clinicians.");
  return data.map((c) => ({ staffId: c.staff_id, profileId: c.profile_id, name: c.full_name, jobTitle: c.job_title }));
}

/** Three weeks of free times, from tomorrow and at least 24 hours ahead (the database checks it too). */
const DAYS = 21;

async function slotsFor(clinician: OnlineClinician, type: OnlineType, fromDay: string): Promise<DaySlots[]> {
  const admin = createAdminClient();
  const fromIso = londonInstant(fromDay, "00:00");
  const toIso = londonInstant(addDays(fromDay, DAYS), "00:00");
  const [hours, busy, places] = await Promise.all([
    admin.from("clinician_availability").select("weekday, start_time, end_time, location_id").eq("staff_id", clinician.staffId).eq("active", true),
    admin.rpc("online_busy", { _staff: clinician.staffId, _from: fromIso, _to: toIso }),
    admin.from("locations").select("id, kind"),
  ]);
  if (hours.error || busy.error || places.error) throw new Error("Could not load free times.");
  const kindOf = new Map(places.data.map((p) => [p.id, p.kind]));
  // Only hours at a place that suits the appointment (or with no place set).
  const suitable = hours.data.filter((h) => h.location_id === null || kindOf.get(h.location_id) === type.locationKind);
  const blocked: [number, number][] = busy.data.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)]);
  try {
    const session = await googleSessionFor(clinician.profileId);
    if (session) for (const event of await listEvents(session, fromIso, toIso)) if (!event.allDay) blocked.push([Date.parse(event.start), Date.parse(event.end)]);
  } catch (error) {
    if (!(error instanceof GoogleDisconnectedError)) console.error("Google busy times not read for online booking.");
  }
  return computeSlots({ hours: suitable, blocked, durationMin: type.durationMin, fromDay, days: DAYS, earliest: Date.now() + 24 * 60 * 60 * 1000 });
}

/**
 * Free times for a type with one clinician, or with any of them: then each time is offered once,
 * with the first clinician free at it.
 */
export async function getOnlineSlots(type: OnlineType, clinicians: OnlineClinician[], fromDay = addDays(todayInLondon(), 1)): Promise<OnlineDay[]> {
  const perClinician = await Promise.all(clinicians.map(async (c) => ({ c, days: await slotsFor(c, type, fromDay) })));
  const days: OnlineDay[] = [];
  for (let i = 0; i < DAYS; i += 1) {
    const day = addDays(fromDay, i);
    const seen = new Map<string, OnlineSlot>();
    for (const { c, days: list } of perClinician) {
      for (const slot of list.find((d) => d.day === day)?.slots ?? []) {
        if (!seen.has(slot.startsAt)) seen.set(slot.startsAt, { ...slot, staffId: c.staffId });
      }
    }
    days.push({ day, slots: [...seen.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
  }
  return days;
}

/** Is the clinician still free in their Google Calendar at that time? A calendar that cannot be read does not block. */
export async function stillFreeInGoogle(clinician: OnlineClinician, startsAt: string, durationMin: number): Promise<boolean> {
  try {
    const session = await googleSessionFor(clinician.profileId);
    if (!session) return true;
    const start = Date.parse(startsAt);
    const end = start + durationMin * 60000;
    const events = await listEvents(session, new Date(start).toISOString(), new Date(end).toISOString());
    return !events.some((e) => !e.allDay && Date.parse(e.start) < end && Date.parse(e.end) > start);
  } catch {
    return true;
  }
}
