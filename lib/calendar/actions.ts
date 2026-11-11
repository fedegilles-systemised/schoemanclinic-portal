"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  createEvent as createGoogleEvent,
  deleteEvent as deleteGoogleEvent,
  disconnect,
  GoogleDisconnectedError,
  googleSessionFor,
  updateEvent as updateGoogleEvent,
  type EventInput,
} from "@/lib/calendar/google";
import { isDay } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export type CalendarFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "Google did not accept that. Please try again.";
const RECONNECT = "Your Google Calendar is no longer connected. Connect it again to carry on.";

async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  return user;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 09:30.");

const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a title.").max(200, "Use 200 characters or fewer for the title."),
    day: z.string().refine((value) => isDay(value), "Choose a date."),
    startTime: time,
    endTime: time,
    location: z.string().trim().max(300, "Use 300 characters or fewer for the place.").optional().default(""),
    description: z.string().trim().max(4000, "Use 4,000 characters or fewer for the notes.").optional().default(""),
  })
  .refine((value) => value.endTime > value.startTime, { message: "The end must be after the start.", path: ["endTime"] });

// Google event ids are base32hex for events made by Google, and may carry an instance suffix.
const eventId = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/);

function readEvent(formData: FormData): { input?: EventInput; error?: string } {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = eventSchema.safeParse({
    title: text("title"),
    day: text("day"),
    startTime: text("startTime"),
    endTime: text("endTime"),
    location: text("location"),
    description: text("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const v = parsed.data;
  return {
    input: {
      title: v.title,
      description: v.description,
      location: v.location,
      start: `${v.day}T${v.startTime}:00`,
      end: `${v.day}T${v.endTime}:00`,
    },
  };
}

/** Runs one change against Google for the signed-in staff member, and reports in plain words. */
async function withGoogle(
  user: CurrentUser,
  work: (session: NonNullable<Awaited<ReturnType<typeof googleSessionFor>>>) => Promise<void>,
  saved: string,
): Promise<CalendarFormState> {
  try {
    // Row-level security returns the row only to active staff, so someone who has left the
    // clinic cannot use a connection that is still stored.
    const supabase = await createClient();
    const own = await supabase.from("google_calendar_connections").select("user_id").eq("user_id", user.id).maybeSingle();
    if (own.error || !own.data) return { error: RECONNECT };
    const session = await googleSessionFor(user.id);
    if (!session) return { error: RECONNECT };
    await work(session);
  } catch (error) {
    if (error instanceof GoogleDisconnectedError) {
      // The token is dead, so the connection is cleared and the screen offers to reconnect.
      await disconnect(user.id).catch(() => undefined);
      revalidatePath("/clinic/calendar");
      return { error: RECONNECT };
    }
    console.error(`Calendar change failed: ${error instanceof Error ? error.message : "unknown"}`);
    return { error: GENERIC_FAILURE };
  }
  revalidatePath("/clinic/calendar");
  return { saved };
}

export async function addEvent(_state: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const user = await requireStaff();
  const { input, error } = readEvent(formData);
  if (!input) return { error };
  return withGoogle(user, (session) => createGoogleEvent(session, input), "Added to your Google Calendar.");
}

export async function changeEvent(_state: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const user = await requireStaff();
  const id = eventId.safeParse(formData.get("eventId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const { input, error } = readEvent(formData);
  if (!input) return { error };
  return withGoogle(user, (session) => updateGoogleEvent(session, id.data, input), "Event updated.");
}

export async function removeEvent(_state: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const user = await requireStaff();
  const id = eventId.safeParse(formData.get("eventId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  return withGoogle(user, (session) => deleteGoogleEvent(session, id.data), "Event deleted.");
}

export async function disconnectCalendar(): Promise<CalendarFormState> {
  const user = await requireStaff();
  try {
    await disconnect(user.id);
  } catch {
    return { error: "We could not disconnect your calendar. Please try again." };
  }
  revalidatePath("/clinic/calendar");
  return { saved: "Your Google Calendar is disconnected." };
}
