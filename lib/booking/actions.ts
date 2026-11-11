"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { createEvent, deleteEvent, googleSessionFor, listEvents } from "@/lib/calendar/google";
import { londonParts } from "@/lib/calendar/time";
import { appointmentEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { formatDayDate } from "@/lib/format";
import { notifyPatient, type Delivery } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";
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
  return { saved: `Appointment cancelled. ${deliveryLine(delivery)}` };
}

/**
 * After a booking or a cancellation: keep the clinician's Google Calendar in step (an event with the
 * clinic reference only, never the patient's name) and tell the patient. Nothing here can undo the
 * booking itself; failures are logged.
 */
async function afterChange(appointmentId: string, cancelled: boolean): Promise<Delivery | null> {
  try {
    const admin = createAdminClient();
    const { data: a } = await admin
      .from("appointments")
      .select("id, patient_id, starts_at, duration_min, type, external_id, source, clinician:staff_profiles(user_id, profile:profiles(full_name)), patient:patient_profiles(clinic_ref, first_name)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!a) return null;
    const clinicianUser = a.clinician?.user_id;
    const clinicianName = a.clinician?.profile?.full_name ?? "your clinician";

    if (clinicianUser && a.source === "clinic_hub") {
      try {
        const session = await googleSessionFor(clinicianUser);
        if (session && !cancelled) {
          const start = londonParts(a.starts_at);
          const end = londonParts(new Date(Date.parse(a.starts_at) + a.duration_min * 60000).toISOString());
          const eventId = await createEvent(session, {
            title: `${a.type} · ${a.patient?.clinic_ref ?? "patient"}`,
            description: "Booked in Clinic Hub. Open the patient from the Patient list.",
            location: "",
            start: `${start.day}T${start.time}:00`,
            end: `${end.day}T${end.time}:00`,
          });
          if (eventId) await admin.rpc("set_appointment_calendar_event", { _appointment: a.id, _event: eventId });
        } else if (session && cancelled && a.external_id) {
          await deleteEvent(session, a.external_id);
        }
      } catch {
        console.error("Clinician calendar not updated for a booking.");
      }
    }

    const siteUrl = getSiteUrl();
    const portalUrl = `${siteUrl}/portal/appointments`;
    const time = londonParts(a.starts_at).time;
    const when = `${formatDayDate(a.starts_at)} at ${time}`;
    return await notifyPatient(a.patient_id, {
      topic: "appointments",
      notice: cancelled
        ? { title: "An appointment was cancelled", body: `Your appointment on ${when} has been cancelled.`, link: "/portal/appointments" }
        : { title: "Appointment booked", body: `Your appointment on ${when} is booked.`, link: "/portal/appointments" },
      email: appointmentEmail({ siteUrl, firstName: a.patient?.first_name, when, clinicianName, cancelled, portalUrl }),
      whatsapp: cancelled
        ? `Hello ${a.patient?.first_name ?? ""}, your appointment on ${when} has been cancelled. Please contact the clinic if you would like a new time.`
        : `Hello ${a.patient?.first_name ?? ""}, your appointment with ${clinicianName} is booked for ${when}. To change it, please contact the clinic at least 48 hours before.`,
    });
  } catch {
    console.error("Booking follow-up not completed.");
    return null;
  }
}

/** What staff are told about the messages after a booking or a cancellation. */
function deliveryLine(delivery: Delivery | null): string {
  if (!delivery) return "The patient could not be messaged; please let them know.";
  if (delivery.email === "suspended") return "The patient's account is not active, so no message was sent.";
  const sent = [delivery.email === "sent" ? "email" : null, delivery.whatsapp === "sent" ? "WhatsApp" : null].filter(Boolean);
  if (sent.length) return `The patient was told by ${sent.join(" and ")}.`;
  if (delivery.email === "failed" || delivery.whatsapp === "failed") return "The message to the patient failed; please let them know.";
  return "The patient has messages switched off for appointments; please let them know.";
}
