import "server-only";

import { cache } from "react";

import type { CurrentUser } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { isGhlConfigured } from "@/lib/env";
import { BASE_CHANNELS, defaultFor, GHL_CHANNELS, NOTIFICATION_TOPICS } from "@/lib/profile/notification-options";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 60 * 60;

/** A short-lived address for a private image, or null. A failure never breaks a screen. */
async function signedUrl(bucket: "avatars" | "signatures", path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export const getAvatarUrl = cache((path: string | null) => signedUrl("avatars", path));

export type AccountView = {
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  hasAvatar: boolean;
};

export const getAccount = cache(async (user: CurrentUser): Promise<AccountView> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Could not load your profile.");
  return {
    email: user.email,
    fullName: data?.full_name ?? user.fullName,
    phone: data?.phone ?? null,
    avatarUrl: await getAvatarUrl(data?.avatar_path ?? null),
    hasAvatar: Boolean(data?.avatar_path),
  };
});

/** Every topic and offered channel on or off. A missing row counts as the channel's default. */
export async function getNotificationPreferences(userId: string): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("topic, channel, enabled")
    .eq("user_id", userId);
  if (error) throw new Error("Could not load your notification choices.");
  const saved = new Map<string, boolean>(data.map((row) => [`${row.topic}.${row.channel}`, row.enabled]));
  const result: Record<string, boolean> = {};
  const channels = isGhlConfigured() ? GHL_CHANNELS : BASE_CHANNELS;
  for (const topic of NOTIFICATION_TOPICS) {
    for (const channel of channels) result[`${topic}.${channel}`] = saved.get(`${topic}.${channel}`) ?? defaultFor(channel);
  }
  return result;
}

export type RecordView = {
  clinicRef: string;
  name: string;
  dateOfBirth: string;
  sex: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  clinician: string | null;
};

export type LookedAfterView = {
  patientId: string;
  name: string;
  relationship: string | null;
  canAct: boolean;
};

/** The person's own patient record, and the patients they are a verified guardian of. */
export async function getPatientProfile(): Promise<{ record: RecordView | null; lookedAfter: LookedAfterView[] }> {
  const supabase = await createClient();
  const [records, directory, links] = await Promise.all([
    supabase.rpc("get_my_patient_record"),
    supabase.rpc("get_staff_directory"),
    supabase.from("patient_guardians").select("patient_id, relationship, can_view"),
  ]);
  if (records.error) throw new Error("Could not load your record.");

  const rows = records.data ?? [];
  const own = rows.find((row) => row.is_self) ?? null;
  const clinicians = new Map((directory.data ?? []).map((row) => [row.staff_id, row.full_name]));
  const relationships = new Map((links.data ?? []).map((row) => [row.patient_id, row.relationship]));

  return {
    record: own
      ? {
          clinicRef: own.clinic_ref,
          name: `${own.first_name} ${own.last_name}`,
          dateOfBirth: own.date_of_birth,
          sex: own.sex,
          contactEmail: own.contact_email,
          contactPhone: own.contact_phone,
          country: own.country,
          clinician: own.primary_clinician_id ? (clinicians.get(own.primary_clinician_id) ?? null) : null,
        }
      : null,
    lookedAfter: rows
      .filter((row) => !row.is_self)
      .map((row) => ({
        patientId: row.id,
        name: `${row.first_name} ${row.last_name}`,
        relationship: relationships.get(row.id) ?? null,
        canAct: row.can_act,
      })),
  };
}

export type WorkView = {
  jobTitle: string | null;
  clinicalRole: Database["public"]["Enums"]["staff_role"];
  gmcNumber: string | null;
  active: boolean;
  locations: { name: string; isPrimary: boolean }[];
  signatureUrl: string | null;
  hasSignature: boolean;
};

/** The person's own staff profile, or null if they have none. */
export async function getWorkProfile(userId: string): Promise<WorkView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, job_title, clinical_role, gmc_number, active, signature_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load your work profile.");
  if (!data) return null;

  // Not every role can read this table, so an empty list is normal.
  const { data: places } = await supabase
    .from("staff_locations")
    .select("is_primary, locations(name)")
    .eq("staff_id", data.id);

  return {
    jobTitle: data.job_title,
    clinicalRole: data.clinical_role,
    gmcNumber: data.gmc_number,
    active: data.active,
    locations: (places ?? []).flatMap((row) =>
      row.locations ? [{ name: row.locations.name, isPrimary: row.is_primary }] : [],
    ),
    hasSignature: Boolean(data.signature_path),
    signatureUrl: await signedUrl("signatures", data.signature_path),
  };
}
