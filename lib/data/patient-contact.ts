import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PatientContact = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  sex: string;
  dateOfBirth: string;
};

/** The contact details and postal address the clinic keeps for a patient, read through the person's session. */
export async function getPatientContact(patientId: string): Promise<PatientContact | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_profiles")
    .select("address_line1, address_line2, city, postcode, country, contact_phone, contact_email, sex, date_of_birth")
    .eq("id", patientId)
    .maybeSingle();
  if (!data) return null;
  return {
    addressLine1: data.address_line1 ?? "",
    addressLine2: data.address_line2 ?? "",
    city: data.city ?? "",
    postcode: data.postcode ?? "",
    country: data.country ?? "",
    phone: data.contact_phone ?? "",
    email: data.contact_email ?? "",
    sex: data.sex ?? "",
    dateOfBirth: data.date_of_birth,
  };
}
