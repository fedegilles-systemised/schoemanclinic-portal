import "server-only";

import { GoogleDisconnectedError, googleSessionFor, listEvents } from "@/lib/calendar/google";
import { addDays, isoWeekday, londonInstant, todayInLondon } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export type Slot = { startsAt: string; locationId: string | null };
export type DaySlots = { day: string; slots: Slot[] };

const STEP_MIN = 15;

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Free slots for one clinician and one appointment type over the next days, in London time. A slot
 * is free when it fits inside the clinician's hours, overlaps none of their live bookings (read
 * without patient details), and overlaps nothing timed in their Google Calendar if they have
 * connected it. The database checks hours and overlaps again when the booking is made.
 */
export async function freeSlots(params: { staffId: string; clinicianUserId: string; durationMin: number; fromDay?: string; days?: number }): Promise<DaySlots[]> {
  const supabase = await createClient();
  const today = todayInLondon();
  const fromDay = params.fromDay && params.fromDay > today ? params.fromDay : today;
  const days = params.days ?? 14;
  const toDay = addDays(fromDay, days);
  const fromIso = londonInstant(fromDay, "00:00");
  const toIso = londonInstant(toDay, "00:00");

  const [hours, busy] = await Promise.all([
    supabase.from("clinician_availability").select("weekday, start_time, end_time, location_id").eq("staff_id", params.staffId).eq("active", true),
    supabase.rpc("clinician_busy", { _staff: params.staffId, _from: fromIso, _to: toIso }),
  ]);
  if (hours.error || busy.error) throw new Error("Could not load the clinician's diary.");
  const blocked: [number, number][] = busy.data.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)]);

  // Their own Google Calendar, if connected. A failure here hides nothing: the slot list is then
  // based on Clinic Hub bookings alone, and the clinician's calendar shows any clash.
  try {
    const session = await googleSessionFor(params.clinicianUserId);
    if (session) {
      for (const event of await listEvents(session, fromIso, toIso)) {
        if (!event.allDay) blocked.push([Date.parse(event.start), Date.parse(event.end)]);
      }
    }
  } catch (error) {
    if (!(error instanceof GoogleDisconnectedError)) console.error("Google busy times not read for booking.");
  }

  return computeSlots({ hours: hours.data, blocked, durationMin: params.durationMin, fromDay, days, earliest: Date.now() + 60 * 60 * 1000 });
}

/**
 * The free starts, every 15 minutes, inside weekly hours and clear of busy times. Shared by staff and
 * patient booking and the public booking page.
 */
export function computeSlots(input: {
  hours: { weekday: number; start_time: string; end_time: string; location_id: string | null }[];
  blocked: [number, number][];
  durationMin: number;
  fromDay: string;
  days: number;
  earliest: number;
}): DaySlots[] {
  const { hours, blocked, durationMin, fromDay, days, earliest } = input;
  const result: DaySlots[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(fromDay, i);
    const weekday = isoWeekday(day);
    const slots: Slot[] = [];
    for (const window of hours.filter((h) => h.weekday === weekday)) {
      const start = minutes(window.start_time);
      const end = minutes(window.end_time);
      for (let t = start; t + durationMin <= end; t += STEP_MIN) {
        const startsAt = londonInstant(day, hhmm(t));
        const s = Date.parse(startsAt);
        const e = s + durationMin * 60 * 1000;
        if (s < earliest) continue;
        if (blocked.some(([bs, be]) => bs < e && be > s)) continue;
        if (slots.some((slot) => slot.startsAt === startsAt)) continue;
        slots.push({ startsAt, locationId: window.location_id });
      }
    }
    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    result.push({ day, slots });
  }
  return result;
}
