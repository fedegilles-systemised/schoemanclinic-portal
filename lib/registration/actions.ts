"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getMyRegistration } from "@/lib/data/registration";
import { extensionFor, fileKind, MAX_FILE_BYTES } from "@/lib/files";
import { DEFAULT_COUNTRY, REGISTRATION_VERSION } from "@/lib/registration/constants";
import { createClient } from "@/lib/supabase/server";

export type RegistrationFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** The database's messages are written for people; anything else becomes a plain failure. */
function friendly(message: string | undefined): string {
  const known = [
    "Confirm your details and agree to continue.",
    "Choose your sex at birth.",
    "Upload a copy of your photo ID.",
    "Answer every question marked as needed.",
    "You do not need to complete this form.",
    "This form is already complete.",
  ];
  return known.find((k) => message?.includes(k)) ?? GENERIC_FAILURE;
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

const required = (message: string, max: number) => z.string({ message }).trim().min(1, message).max(max, `${message} Use ${max} characters or fewer.`);
const optional = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer for ${label}.`)
    .optional();

const schema = z.object({
  title: optional("the title", 40),
  addressLine1: optional("the first line of the address", 200),
  addressLine2: optional("the second line of the address", 200),
  town: optional("the town or city", 120),
  postcode: optional("the postcode", 20),
  country: optional("the country", 80),
  gender: optional("gender", 100),
  phone: z.string().trim().regex(PHONE, "Enter a phone number we can call, or leave it empty.").optional(),
  nextOfKinName: required("Enter your next of kin's name.", 120),
  nextOfKinRelationship: required("Enter your next of kin's relationship to you.", 80),
  nextOfKinPhone: z.string({ message: "Enter your next of kin's telephone number." }).trim().regex(PHONE, "Enter your next of kin's telephone number."),
  gpName: required("Enter your GP's name.", 120),
  gpPractice: required("Enter your GP practice's name and address.", 400),
  sex: z.enum(["F", "M"], { message: "Choose your sex at birth." }),
  occupation: required("Enter your occupation.", 120),
  mainReason: required("Tell us the main reason for your visit.", 2000),
  concernDuration: required("Tell us how long you have had this concern.", 500),
  alreadyTried: required("Tell us what you have already tried. If nothing, say so.", 2000),
  healthGoals: required("Tell us your top three health goals for the next 12 months.", 2000),
  agreed: z.literal("on", { message: "Confirm your details and agree to the Privacy Notice and the Terms of Treatment and Fees to continue." }),
});

/**
 * A new patient completes the registration form for themselves, once. The photo ID goes to its own private
 * store first; the database then writes the registration, fills the gaps on their record, and keeps a permanent
 * copy of the form. Nothing is written if the form is not complete.
 */
export async function submitRegistration(_state: RegistrationFormState, formData: FormData): Promise<RegistrationFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  const me = await getMyRegistration();
  if (!me || !me.needed) redirect("/portal");

  const parsed = schema.safeParse({
    title: field(formData, "title"),
    addressLine1: field(formData, "addressLine1"),
    addressLine2: field(formData, "addressLine2"),
    town: field(formData, "town"),
    postcode: field(formData, "postcode"),
    country: field(formData, "country") ?? DEFAULT_COUNTRY,
    gender: field(formData, "gender"),
    phone: field(formData, "phone"),
    nextOfKinName: field(formData, "nextOfKinName"),
    nextOfKinRelationship: field(formData, "nextOfKinRelationship"),
    nextOfKinPhone: field(formData, "nextOfKinPhone"),
    gpName: field(formData, "gpName"),
    gpPractice: field(formData, "gpPractice"),
    sex: field(formData, "sex"),
    occupation: field(formData, "occupation"),
    mainReason: field(formData, "mainReason"),
    concernDuration: field(formData, "concernDuration"),
    alreadyTried: field(formData, "alreadyTried"),
    healthGoals: field(formData, "healthGoals"),
    agreed: field(formData, "agreed"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };

  const file = formData.get("identity");
  if (!(file instanceof File) || file.size === 0) return { error: "Upload a copy of your photo ID: a passport or a driving licence." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 10 MB. Send a smaller one." };
  if (!(await allowAuthAttempt("document-upload", user.email))) return { error: "Too many attempts at once. Please wait a while and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileKind(bytes);
  if (!type) return { error: "Send the photo ID as a PDF, JPEG or PNG file." };

  const supabase = await createClient();
  const path = `${me.patientId}/${randomUUID()}.${extensionFor(type)}`;
  const upload = await supabase.storage.from("identity").upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) return { error: "The file could not be saved. Please choose it again and try again." };

  const d = parsed.data;
  const { error } = await supabase.rpc("submit_registration", {
    _d: {
      title: d.title ?? "",
      address_line1: d.addressLine1 ?? "",
      address_line2: d.addressLine2 ?? "",
      town: d.town ?? "",
      postcode: d.postcode ?? "",
      country: d.country ?? DEFAULT_COUNTRY,
      gender: d.gender ?? "",
      phone: d.phone ?? "",
      sex: d.sex,
      next_of_kin_name: d.nextOfKinName,
      next_of_kin_relationship: d.nextOfKinRelationship,
      next_of_kin_phone: d.nextOfKinPhone,
      gp_name: d.gpName,
      gp_practice: d.gpPractice,
      occupation: d.occupation,
      main_reason: d.mainReason,
      concern_duration: d.concernDuration,
      already_tried: d.alreadyTried,
      health_goals: d.healthGoals,
      identity_path: path,
      agreed: true,
      news_opt_out: formData.get("newsOptOut") === "on",
      whatsapp_consent: formData.get("whatsapp") === "on",
      version: REGISTRATION_VERSION,
    },
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath("/portal", "layout");
  redirect("/portal");
}

/** A PA or admin marks a patient's photo ID as checked, once. */
export async function checkIdentity(_state: RegistrationFormState, formData: FormData): Promise<RegistrationFormState> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "pa" || r === "admin")) redirect("/clinic");
  const id = z.uuid().safeParse(formData.get("patientId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_identity", { _patient: id.data });
  if (error) return { error: error.message.includes("already checked") ? "This identity is already checked." : "You cannot check this identity." };
  revalidatePath(`/clinic/patients/${id.data}`);
  return { saved: "Marked as checked.", sentAt: Date.now() };
}
