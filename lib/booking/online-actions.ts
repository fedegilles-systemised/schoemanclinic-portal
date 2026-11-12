"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { allowAuthAttempt } from "@/lib/auth/throttle";
import { afterChange } from "@/lib/booking/follow-up";
import { getOnlineClinicians, getOnlineTypes, stillFreeInGoogle } from "@/lib/booking/online";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnlineBookingState = { error?: string };

const known = [
  "That appointment cannot be booked online.",
  "Enter your first and last name.",
  "Enter your date of birth.",
  "Online booking is for adults. Please call the clinic to book for a child.",
  "Enter a valid email address.",
  "Enter a phone number.",
  "You already have bookings with us. Please contact the clinic to book more.",
  "That clinician cannot be booked.",
  "Choose a time from tomorrow up to four months ahead.",
  "That location does not suit this appointment.",
  "That time is not available. Please choose another.",
  "That time has just been taken. Please choose another.",
];

/**
 * A new patient books on the public page. Nobody is signed in, so the server books through its own
 * access, and only through the database function made for this, which checks everything again.
 * A hidden field catches simple bots, and attempts are limited per address and per email.
 */
export async function bookOnline(_state: OnlineBookingState, formData: FormData): Promise<OnlineBookingState> {
  // Bots fill every field; people never see this one.
  if (formData.get("website")) redirect("/book/done");

  const parsed = z
    .object({
      typeId: z.uuid(),
      staffId: z.uuid(),
      startsAt: z.iso.datetime({ offset: true }),
      locationId: z.uuid().optional(),
      firstName: z.string().trim().min(1, "Enter your first and last name.").max(80, "Use 80 characters or fewer for each name."),
      lastName: z.string().trim().min(1, "Enter your first and last name.").max(80, "Use 80 characters or fewer for each name."),
      dateOfBirth: z.iso.date("Enter your date of birth."),
      email: z.email("Enter a valid email address.").max(254),
      phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number."),
      consent: z.literal("on", { error: "Please confirm you have read the privacy notice." }),
    })
    .safeParse({
      typeId: formData.get("typeId"),
      staffId: formData.get("staffId"),
      startsAt: formData.get("startsAt"),
      locationId: formData.get("locationId") || undefined,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      dateOfBirth: formData.get("dateOfBirth"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      consent: formData.get("consent") ?? undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const input = parsed.data;
  if (!(await allowAuthAttempt("online-booking", input.email))) return { error: "Too many attempts. Please wait a while, or call the clinic." };

  const [types, clinicians] = await Promise.all([getOnlineTypes(), getOnlineClinicians()]);
  const type = types.find((t) => t.id === input.typeId);
  const clinician = clinicians.find((c) => c.staffId === input.staffId);
  if (!type || !clinician) return { error: "That appointment cannot be booked online." };
  if (!(await stillFreeInGoogle(clinician, input.startsAt, type.durationMin))) return { error: "That time has just been taken. Please choose another." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("book_online", {
    _type: input.typeId,
    _staff: input.staffId,
    _starts_at: input.startsAt,
    _location: input.locationId ?? null,
    _first_name: input.firstName,
    _last_name: input.lastName,
    _date_of_birth: input.dateOfBirth,
    _email: input.email,
    _phone: input.phone,
  });
  if (error || !data?.[0]) {
    if (error && known.includes(error.message)) return { error: error.message };
    return { error: "We could not book that. Please try again, or call the clinic." };
  }
  await afterChange(data[0].appointment_id, "booked");
  redirect("/book/done");
}
