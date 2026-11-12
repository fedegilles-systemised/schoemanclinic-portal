"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { todayInLondon } from "@/lib/calendar/time";
import { createClient } from "@/lib/supabase/server";

export type CareTeamFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not do that. Please try again.";
const CARE_TEAM_EDITORS = ["pa", "admin", "doctor"] as const;

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (CARE_TEAM_EDITORS as readonly string[]).includes(role))) {
    redirect("/clinic");
  }
  return user;
}

const addSchema = z.object({
  patientId: z.uuid(),
  staffId: z.uuid("Choose a team member."),
  relationship: z.enum(["primary_doctor", "doctor", "nurse", "pa", "health_coach"], "Choose their role for this patient."),
});

/** Adds someone to a patient's care team. Row-level security checks who may, for which patient. */
export async function addToCareTeam(_state: CareTeamFormState, formData: FormData): Promise<CareTeamFormState> {
  await requireEditor();
  const parsed = addSchema.safeParse({
    patientId: formData.get("patientId"),
    staffId: formData.get("staffId"),
    relationship: formData.get("relationship"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.from("care_team").insert({
    patient_id: parsed.data.patientId,
    staff_id: parsed.data.staffId,
    relationship: parsed.data.relationship,
    since: todayInLondon(),
  });
  if (error) {
    // One current primary doctor per patient, enforced by a unique index.
    if (error.code === "23505") return { error: "This patient already has a primary doctor. Remove them first, or add this doctor as a doctor." };
    return { error: GENERIC_FAILURE };
  }
  revalidatePath("/clinic/patients");
  return { saved: "Added to the care team." };
}

/**
 * Takes someone off a care team today. The row is kept with today as the leaving day, so the
 * history of who looked after the patient stays; access stops at once.
 */
export async function removeFromCareTeam(_state: CareTeamFormState, formData: FormData): Promise<CareTeamFormState> {
  await requireEditor();
  const id = z.uuid().safeParse(formData.get("careTeamId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_team")
    .update({ until: todayInLondon() })
    .eq("id", id.data)
    .is("until", null)
    .select("id");
  if (error || !data?.length) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/patients");
  return { saved: "Removed from the care team." };
}

// A patient's contact details and postal address ------------------------------------------------

const contactSchema = z.object({
  patientId: z.uuid(),
  addressLine1: z.string().trim().max(200, "Use 200 characters or fewer for the first line."),
  addressLine2: z.string().trim().max(200, "Use 200 characters or fewer for the second line."),
  city: z.string().trim().max(100, "Use 100 characters or fewer for the town or city."),
  postcode: z.string().trim().max(20, "Use 20 characters or fewer for the postcode."),
  country: z.string().trim().max(100, "Use 100 characters or fewer for the country."),
  phone: z.string().trim().max(40, "Use 40 characters or fewer for the phone number."),
  email: z
    .string()
    .trim()
    .max(254, "Use 254 characters or fewer for the email address.")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address."),
  // Sex at birth: it decides which panels and prescriptions a patient gets, so it is chosen, never typed.
  sex: z.enum(["", "F", "M"], { message: "Choose female, male or leave it unrecorded." }),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of birth.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now() && date.getUTCFullYear() >= 1900;
    }, "Enter a real date of birth, after 1900 and not in the future."),
});

/**
 * A PA keeps a patient's postal address, country, phone number, contact email, sex at birth and date
 * of birth. SignatureRx needs them for every prescription. Row-level security decides which patients a PA may change; an empty box clears it.
 */
export async function updatePatientContact(_state: CareTeamFormState, formData: FormData): Promise<CareTeamFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.includes("pa")) redirect("/clinic");
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const parsed = contactSchema.safeParse({
    patientId: text("patientId"),
    addressLine1: text("addressLine1"),
    addressLine2: text("addressLine2"),
    city: text("city"),
    postcode: text("postcode"),
    country: text("country"),
    phone: text("phone"),
    email: text("email"),
    sex: text("sex"),
    dateOfBirth: text("dateOfBirth"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const d = parsed.data;
  const empty = (value: string) => (value === "" ? null : value);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_profiles")
    .update({
      address_line1: empty(d.addressLine1),
      address_line2: empty(d.addressLine2),
      city: empty(d.city),
      postcode: empty(d.postcode),
      country: empty(d.country),
      contact_phone: empty(d.phone),
      contact_email: empty(d.email),
      sex: empty(d.sex),
      date_of_birth: d.dateOfBirth,
    })
    .eq("id", d.patientId)
    .select("id");
  // An update that row-level security does not allow changes nothing and is not an error.
  if (error || !data || data.length === 0) return { error: "You cannot change this patient's details." };
  revalidatePath(`/clinic/patients/${d.patientId}`);
  return { saved: "Saved." };
}
