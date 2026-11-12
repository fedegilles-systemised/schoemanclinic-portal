import "server-only";

import { isSignatureRxConfigured, isSignatureRxSigningEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type SentPrescription = {
  id: string;
  srxPrescriptionId: string | null;
  action: string;
  status: string | null;
  detailedStatus: string | null;
  sentAt: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  sentBy: string;
};

export type SignatureRxPanel = {
  configured: boolean;
  signingEnabled: boolean;
  /** The signed-in doctor has saved their integration code. */
  hasCode: boolean;
  /** What the patient's record still lacks for SignatureRx, in words. Empty when nothing is missing. */
  missing: string[];
  sent: SentPrescription[];
};

/** Digits only, with the UK country code in place of a leading zero, as SignatureRx wants it. */
export function toInternationalPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function toSrxGender(sex: string | null | undefined): "Male" | "Female" | "Other" {
  const first = (sex ?? "").trim().charAt(0).toLowerCase();
  return first === "m" ? "Male" : first === "f" ? "Female" : "Other";
}

export type PatientForSrx = {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  email: string;
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country: string;
  clinicRef: string;
};

/**
 * The patient's details as SignatureRx needs them, read through the signed-in person's session, with
 * the words for anything the record lacks. Names no value, so the list can be shown on screen.
 */
export async function getPatientForSignatureRx(patientId: string): Promise<{ patient: PatientForSrx | null; missing: string[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_profiles")
    .select("clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, address_line1, address_line2, city, postcode, user_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!data) return { patient: null, missing: ["the patient's record"] };

  let email = data.contact_email;
  let phone = data.contact_phone;
  if (data.user_id) {
    const account = await supabase.from("profiles").select("email, phone").eq("id", data.user_id).maybeSingle();
    email = email ?? account.data?.email ?? null;
    phone = phone ?? account.data?.phone ?? null;
  }

  const missing: string[] = [];
  const line1 = data.address_line1?.trim();
  if (!line1) missing.push("the first line of the address");
  const international = toInternationalPhone(phone);
  if (!international) missing.push("a phone number");
  if (!email?.trim()) missing.push("an email address");
  if (!data.country?.trim()) missing.push("the country");
  // Sex at birth decides the prescription's details, so a missing value stops the send: it is never guessed.
  if (!data.sex?.trim()) missing.push("sex at birth");
  const [year, month, day] = (data.date_of_birth ?? "").split("-");
  if (!/^(19|20)\d{2}$/.test(year ?? "") || !month || !day) missing.push("the date of birth");
  if (missing.length > 0 || !line1 || !international || !email || !data.country || !year || !month || !day) return { patient: null, missing };

  return {
    missing,
    patient: {
      firstName: data.first_name,
      lastName: data.last_name,
      gender: toSrxGender(data.sex),
      email: email.trim(),
      phone: international,
      birthDay: day,
      birthMonth: month,
      birthYear: year,
      addressLine1: line1,
      addressLine2: data.address_line2?.trim() || undefined,
      city: data.city?.trim() || undefined,
      postcode: data.postcode?.trim() || undefined,
      country: data.country.trim(),
      clinicRef: data.clinic_ref,
    },
  };
}

/** What the clinic page needs to show and offer for one repeat request. */
export async function getSignatureRxPanel(requestId: string, patientId: string): Promise<SignatureRxPanel> {
  const configured = isSignatureRxConfigured();
  const supabase = await createClient();
  const [sent, code, patient] = await Promise.all([
    supabase
      .from("signaturerx_prescriptions")
      .select("id, srx_prescription_id, action, status, detailed_status, sent_at, last_checked_at, last_error, sent_by")
      .eq("repeat_request_id", requestId)
      .order("sent_at", { ascending: false }),
    supabase.rpc("has_my_signaturerx_code"),
    getPatientForSignatureRx(patientId),
  ]);
  return {
    configured,
    signingEnabled: isSignatureRxSigningEnabled(),
    hasCode: code.data === true,
    missing: patient.missing,
    sent: (sent.data ?? []).map((row) => ({
      id: row.id,
      srxPrescriptionId: row.srx_prescription_id,
      action: row.action,
      status: row.status,
      detailedStatus: row.detailed_status,
      sentAt: row.sent_at,
      lastCheckedAt: row.last_checked_at,
      lastError: row.last_error,
      sentBy: row.sent_by,
    })),
  };
}
