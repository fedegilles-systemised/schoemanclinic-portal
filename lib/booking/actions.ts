"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { afterChange, deliveryLine } from "@/lib/booking/follow-up";
import { googleSessionFor, listEvents } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";

export type BookingFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not book that. Please try again.";

function friendly(error: { code?: string; message: string }): string {
  return ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : GENERIC_FAILURE;
}

const bookSchema = z.object({
  patientId: z.uuid(),
  staffId: z.uuid(),
  typeId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  locationId: z.uuid().optional(),
  back: z.enum(["portal", "clinic"]),
});

/** Books a slot. The database decides who may book what; the server then adds it to the clinician's calendar and tells the patient. */
export async function bookAppointment(_state: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended) redirect("/login");
  const parsed = bookSchema.safeParse({
    patientId: formData.get("patientId"),
    staffId: formData.get("staffId"),
    typeId: formData.get("typeId"),
    startsAt: formData.get("startsAt"),
    locationId: formData.get("locationId") || undefined,
    back: formData.get("back"),
  });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const input = parsed.data;
  if (!(await allowAuthAttempt("booking", user.email))) return { error: "Too many bookings at once. Please wait a while and try again." };
  const supabase = await createClient();
  if (await busyInGoogle(input.staffId, input.typeId, input.startsAt)) {
    return { error: "That time is no longer free in the clinician's calendar. Please choose another." };
  }
  const { data: appointmentId, error } = await supabase.rpc("book_appointment", {
    _patient: input.patientId,
    _staff: input.staffId,
    _type: input.typeId,
    _starts_at: input.startsAt,
    _location: input.locationId,
  });
  if (error) return { error: friendly(error) };

  const delivery = await afterChange(appointmentId, false);
  if (input.back === "portal") {
    revalidatePath("/portal/appointments");
    redirect("/portal/appointments?booked=1");
  }
  revalidatePath(`/clinic/patients/${input.patientId}`);
  revalidatePath("/clinic/diary", "layout");
  const told = delivery?.email === "sent" || delivery?.whatsapp === "sent" ? "told" : "not-told";
  redirect(`/clinic/patients/${input.patientId}?booked=${told}`);
}

/**
 * Checks the clinician's Google Calendar again at the moment of booking, because a free time listed a
 * few minutes ago may have been filled there since. A calendar that cannot be read does not block.
 */
async function busyInGoogle(staffId: string, typeId: string, startsAt: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const [{ data: type }, { data: directory }] = await Promise.all([
      supabase.from("appointment_types").select("duration_min").eq("id", typeId).maybeSingle(),
      supabase.rpc("get_staff_directory"),
    ]);
    const clinician = directory?.find((d) => d.staff_id === staffId);
    if (!type || !clinician) return false;
    const session = await googleSessionFor(clinician.profile_id);
    if (!session) return false;
    const start = Date.parse(startsAt);
    const end = start + type.duration_min * 60000;
    const events = await listEvents(session, new Date(start).toISOString(), new Date(end).toISOString());
    return events.some((e) => !e.allDay && Date.parse(e.start) < end && Date.parse(e.end) > start);
  } catch {
    return false;
  }
}

/** The team cancels. Patients contact the clinic instead (48-hour policy). */
export async function cancelAppointment(_state: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  const parsed = z.object({ appointmentId: z.uuid(), patientId: z.uuid() }).safeParse({
    appointmentId: formData.get("appointmentId"),
    patientId: formData.get("patientId"),
  });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", { _appointment: parsed.data.appointmentId });
  if (error) return { error: friendly(error) };
  const delivery = await afterChange(parsed.data.appointmentId, true);
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  revalidatePath("/clinic/diary", "layout");
  return { saved: `Appointment cancelled. ${deliveryLine(delivery)}` };
}
