import "server-only";

import { createEvent, deleteEvent, googleSessionFor } from "@/lib/calendar/google";
import { londonParts } from "@/lib/calendar/time";
import { appointmentEmail, onlineBookingEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { formatDayDate } from "@/lib/format";
import { notifyPatient, type Delivery } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookingChange = "booked" | "cancelled" | "moved";

/** Where a booking was before it moved: whose calendar held its event. */
export type PreviousPlace = { clinicianUserId: string | null; eventId: string | null };

/**
 * After a booking, a cancellation or a move: keep the clinicians' Google Calendars in step (an event
 * with the clinic reference only, never the patient's name) and tell the patient. Nothing here can
 * undo the change itself; failures are logged.
 */
export async function afterChange(appointmentId: string, change: BookingChange | boolean, previous?: PreviousPlace): Promise<Delivery | null> {
  const kind: BookingChange = change === true ? "cancelled" : change === false ? "booked" : change;
  try {
    const admin = createAdminClient();
    const { data: a } = await admin
      .from("appointments")
      .select(
        "id, patient_id, starts_at, duration_min, type, external_id, source, booked_online, clinician:staff_profiles(user_id, profile:profiles(full_name)), patient:patient_profiles(clinic_ref, first_name, user_id)",
      )
      .eq("id", appointmentId)
      .maybeSingle();
    if (!a) return null;
    const clinicianUser = a.clinician?.user_id;
    const clinicianName = a.clinician?.profile?.full_name ?? "your clinician";

    if (a.source === "clinic_hub") {
      // A moved booking leaves the old clinician's calendar first.
      if (kind === "moved" && previous?.clinicianUserId && previous.eventId) {
        try {
          const old = await googleSessionFor(previous.clinicianUserId);
          if (old) await deleteEvent(old, previous.eventId);
        } catch {
          console.error("Old calendar event not removed for a moved booking.");
        }
      }
      if (clinicianUser) {
        try {
          const session = await googleSessionFor(clinicianUser);
          if (session && kind !== "cancelled") {
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
          } else if (session && kind === "cancelled" && a.external_id) {
            await deleteEvent(session, a.external_id);
          }
        } catch {
          console.error("Clinician calendar not updated for a booking.");
        }
      }
    }

    const siteUrl = getSiteUrl();
    const portalUrl = `${siteUrl}/portal/appointments`;
    const time = londonParts(a.starts_at).time;
    const when = `${formatDayDate(a.starts_at)} at ${time}`;
    const first = a.patient?.first_name;
    const hello = first ? `Hello ${first}` : "Hello";

    // A new patient who booked online has no portal yet: their confirmation says what happens next.
    if (kind === "booked" && a.booked_online && !a.patient?.user_id) {
      return await notifyPatient(a.patient_id, {
        topic: "appointments",
        email: onlineBookingEmail({ siteUrl, firstName: first, when, clinicianName, appointmentType: a.type }),
        whatsapp: `${hello}, your ${a.type.toLowerCase()} with ${clinicianName} is booked for ${when}. The clinic will be in touch before your appointment.`,
      });
    }

    const titles: Record<BookingChange, string> = { booked: "Appointment booked", cancelled: "An appointment was cancelled", moved: "Appointment moved" };
    const bodies: Record<BookingChange, string> = {
      booked: `Your appointment on ${when} is booked.`,
      cancelled: `Your appointment on ${when} has been cancelled.`,
      moved: `Your appointment has moved to ${when}.`,
    };
    return await notifyPatient(a.patient_id, {
      topic: "appointments",
      notice: { title: titles[kind], body: bodies[kind], link: "/portal/appointments" },
      email: appointmentEmail({ siteUrl, firstName: first, when, clinicianName, cancelled: kind === "cancelled", moved: kind === "moved", portalUrl }),
      whatsapp:
        kind === "cancelled"
          ? `${hello}, your appointment on ${when} has been cancelled. Please contact the clinic if you would like a new time.`
          : kind === "moved"
            ? `${hello}, your appointment has moved. It is now with ${clinicianName} on ${when}. Please contact the clinic if this time does not suit you.`
            : `${hello}, your appointment with ${clinicianName} is booked for ${when}. To change it, please contact the clinic at least 48 hours before.`,
    });
  } catch {
    console.error("Booking follow-up not completed.");
    return null;
  }
}

/** What staff are told about the messages after a booking, a cancellation or a move. */
export function deliveryLine(delivery: Delivery | null): string {
  if (!delivery) return "The patient could not be messaged; please let them know.";
  if (delivery.email === "suspended") return "The patient's account is not active, so no message was sent.";
  const sent = [delivery.email === "sent" ? "email" : null, delivery.whatsapp === "sent" ? "WhatsApp" : null].filter(Boolean);
  if (sent.length) return `The patient was told by ${sent.join(" and ")}.`;
  if (delivery.email === "failed" || delivery.whatsapp === "failed") return "The message to the patient failed; please let them know.";
  return "The patient has messages switched off for appointments; please let them know.";
}
