"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { allowAuthAttempt } from "@/lib/auth/throttle";
import { afterChange } from "@/lib/booking/follow-up";
import { getOnlineClinicians, getOnlineTypes, stillFreeInGoogle } from "@/lib/booking/online";
import { getTurnstileSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cloudflare Turnstile, when its keys are set: the server asks Cloudflare whether the check on the
 * form was passed. Without the keys the page works without it (the other limits still apply).
 */
async function passesBotCheck(token: FormDataEntryValue | null): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

export type OnlineBookingState = { error?: string };

const known = [
  "That appointment cannot be booked online.",
  "Enter your first and last name.",
  "Enter your date of birth.",
  "Online booking is for adults. Please call the clinic to book for a child.",
  "Enter a valid email address.",
  "Enter a phone number.",
  "We cannot take this booking online. Please contact the clinic.",
  "That clinician cannot be booked.",
  "Choose a time at least a day ahead, within the next three weeks.",
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
      consent: z.literal("on", { error: "Please confirm you have read the privacy notice and terms." }),
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
  if (!(await passesBotCheck(formData.get("cf-turnstile-response")))) return { error: "Please complete the check that you are not a robot, then try again." };

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
