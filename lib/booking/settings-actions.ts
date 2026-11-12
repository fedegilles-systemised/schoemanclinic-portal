"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SettingsFormState = { error?: string; saved?: string };
const GENERIC_FAILURE = "We could not save that. Please try again.";

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.isStaff) redirect("/clinic");
  return user;
}

/** Admins only; the database checks it too. */
export async function addAppointmentType(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireStaff();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name the appointment.").max(120),
      durationMin: z.coerce.number().int().min(5, "At least 5 minutes.").max(480, "At most 8 hours."),
      locationKind: z.enum(["clinic", "video"]),
      bookableByPatients: z.boolean(),
      bookableOnline: z.boolean(),
    })
    .safeParse({
      name: formData.get("name"),
      durationMin: formData.get("durationMin"),
      locationKind: formData.get("locationKind"),
      bookableByPatients: formData.get("bookableByPatients") === "on",
      bookableOnline: formData.get("bookableOnline") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("appointment_types").insert({
    name: parsed.data.name,
    duration_min: parsed.data.durationMin,
    location_kind: parsed.data.locationKind,
    bookable_by_patients: parsed.data.bookableByPatients,
    bookable_online: parsed.data.bookableOnline,
  });
  if (error) return { error: error.code === "42501" ? "Only an admin can add appointment types." : GENERIC_FAILURE };
  revalidatePath("/clinic/booking");
  return { saved: "Appointment type added." };
}

export async function setTypeActive(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireStaff();
  const parsed = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointment_types").update({ active: parsed.data.active === "true" }).eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/booking");
  return { saved: "Saved." };
}

/** Admins only: whether new patients can book this type on the public booking page. */
export async function setTypeOnline(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireStaff();
  const parsed = z.object({ id: z.uuid(), online: z.enum(["true", "false"]) }).safeParse({ id: formData.get("id"), online: formData.get("online") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointment_types").update({ bookable_online: parsed.data.online === "true" }).eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/booking");
  revalidatePath("/book");
  return { saved: "Saved." };
}

/** Admins and PAs set anyone's hours; a clinician sets their own. The database checks which. */
export async function addHours(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireStaff();
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter times like 09:00.");
  const parsed = z
    .object({ staffId: z.uuid("Choose a clinician."), weekday: z.coerce.number().int().min(1).max(7), start: time, end: time, locationId: z.uuid().optional() })
    .refine((v) => v.end > v.start, { message: "The end must be after the start." })
    .safeParse({
      staffId: formData.get("staffId"),
      weekday: formData.get("weekday"),
      start: formData.get("start"),
      end: formData.get("end"),
      locationId: formData.get("locationId") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("clinician_availability").insert({
    staff_id: parsed.data.staffId,
    weekday: parsed.data.weekday,
    start_time: parsed.data.start,
    end_time: parsed.data.end,
    location_id: parsed.data.locationId ?? null,
  });
  if (error) return { error: error.code === "42501" ? "You can set only your own hours." : GENERIC_FAILURE };
  revalidatePath("/clinic/booking");
  return { saved: "Hours added." };
}

export async function removeHours(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("clinician_availability").update({ active: false }).eq("id", id.data).select("id");
  if (error || !data?.length) return { error: "You can change only your own hours." };
  revalidatePath("/clinic/booking");
  return { saved: "Hours removed." };
}
