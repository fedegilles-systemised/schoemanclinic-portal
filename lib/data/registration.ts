import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MyRegistration = {
  patientId: string;
  /** True when the signed-in patient has this form to complete and has not yet. */
  needed: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string | null;
  phone: string | null;
  sex: string | null;
  gender: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
};

/** The signed-in patient's own record as the form needs it. Null for anyone who is not a patient. */
export async function getMyRegistration(): Promise<MyRegistration | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_registration");
  if (error) throw new Error("Could not load the registration.");
  const row = data[0];
  if (!row) return null;
  return {
    patientId: row.patient_id,
    needed: row.needed,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    email: row.email,
    phone: row.phone,
    sex: row.sex,
    gender: row.gender,
    country: row.country,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postcode: row.postcode,
  };
}

export type RegistrationDetail = {
  id: string;
  submittedAt: string;
  version: string;
  title: string | null;
  address: string | null;
  nextOfKin: { name: string; relationship: string; phone: string };
  gp: { name: string; practice: string };
  occupation: string;
  mainReason: string;
  concernDuration: string;
  alreadyTried: string;
  healthGoals: string;
  newsOptOut: boolean;
  whatsappConsent: boolean;
  identityCheckedAt: string | null;
  identityCheckedBy: string | null;
};

/** A patient's registration, for the team that can open their record. Row-level security decides. */
export async function getRegistration(patientId: string): Promise<RegistrationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_registrations")
    .select(
      "id, submitted_at, version, title, address_line1, address_line2, town, postcode, country, next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, gp_name, gp_practice, occupation, main_reason, concern_duration, already_tried, health_goals, news_opt_out, whatsapp_consent, identity_checked_at, identity_checked_by",
    )
    .eq("patient_id", patientId)
    .maybeSingle();
  if (error) throw new Error("Could not load the registration.");
  if (!data) return null;
  const address = [data.address_line1, data.address_line2, data.town, data.postcode, data.country].filter((part): part is string => Boolean(part)).join(", ");
  return {
    id: data.id,
    submittedAt: data.submitted_at,
    version: data.version,
    title: data.title,
    address: address || null,
    nextOfKin: { name: data.next_of_kin_name, relationship: data.next_of_kin_relationship, phone: data.next_of_kin_phone },
    gp: { name: data.gp_name, practice: data.gp_practice },
    occupation: data.occupation,
    mainReason: data.main_reason,
    concernDuration: data.concern_duration,
    alreadyTried: data.already_tried,
    healthGoals: data.health_goals,
    newsOptOut: data.news_opt_out,
    whatsappConsent: data.whatsapp_consent,
    identityCheckedAt: data.identity_checked_at,
    identityCheckedBy: data.identity_checked_by,
  };
}
