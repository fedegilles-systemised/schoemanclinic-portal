"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { newPasswordSchema, PASSWORD_RULES_MESSAGE } from "@/lib/auth/password-rules";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { isGhlConfigured } from "@/lib/env";
import { BASE_CHANNELS, defaultFor, GHL_CHANNELS, NOTIFICATION_TOPICS } from "@/lib/profile/notification-options";
import { bytesMatchType, IMAGE_TYPES } from "@/lib/profile/image-check";
import { createClient } from "@/lib/supabase/server";

/** What a profile form hands back. `saved` is the confirmation to show. */
export type ProfileFormState = { error?: string; saved?: string };

const TRY_LATER = "Too many attempts. Please wait a few minutes and try again.";
const GENERIC_FAILURE = "We could not save that. Please try again.";

async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended) redirect("/login");
  return user;
}

function refreshScreens() {
  // The name and photo show in the top bar of every screen.
  revalidatePath("/", "layout");
}

// Details ------------------------------------------------------------------------------

const detailsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
  phone: z
    .string()
    .trim()
    .max(30, "Use 30 characters or fewer.")
    .regex(/^[0-9+()\-\s]*$/, "Use digits, spaces, + and - only."),
});

export async function updateDetails(_state: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { error: GENERIC_FAILURE };

  refreshScreens();
  return { saved: "Your details have been saved." };
}

// Photo and signature ------------------------------------------------------------------

type ImageRules = { bucket: "avatars" | "signatures"; maxBytes: number; tooLarge: string };

/** Checks a file field and returns its bytes, or the reason it was refused. */
async function readImage(
  formData: FormData,
  field: string,
  rules: ImageRules,
): Promise<{ ok: true; bytes: Uint8Array; type: string } | { ok: false; error: string }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first." };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }
  if (file.size > rules.maxBytes) return { ok: false, error: rules.tooLarge };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytesMatchType(bytes, file.type)) return { ok: false, error: "That file is not a valid image." };
  return { ok: true, bytes, type: file.type };
}

export async function uploadAvatar(_state: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const image = await readImage(formData, "avatar", {
    bucket: "avatars",
    maxBytes: 2 * 1024 * 1024,
    tooLarge: "Use an image of 2 MB or less.",
  });
  if (!image.ok) return { error: image.error };

  // One fixed path per person: a new photo replaces the old one, so nothing piles up.
  const path = `${user.id}/avatar`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, image.bytes, { upsert: true, contentType: image.type });
  if (uploadError) return { error: GENERIC_FAILURE };

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { error: GENERIC_FAILURE };

  refreshScreens();
  return { saved: "Your photo has been updated." };
}

export async function removeAvatar(): Promise<ProfileFormState> {
  const user = await requireUser();
  const supabase = await createClient();
  // The file stays in storage, as files are never hard-deleted. It is simply no longer shown.
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) return { error: GENERIC_FAILURE };
  refreshScreens();
  return { saved: "Your photo has been removed." };
}

export async function uploadSignature(_state: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  if (!user.roles.includes("doctor")) return { error: "Only doctors have a signature." };
  const image = await readImage(formData, "signature", {
    bucket: "signatures",
    maxBytes: 1024 * 1024,
    tooLarge: "Use an image of 1 MB or less.",
  });
  if (!image.ok) return { error: image.error };

  const path = `${user.id}/signature`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(path, image.bytes, { upsert: true, contentType: image.type });
  if (uploadError) return { error: GENERIC_FAILURE };

  const { error } = await supabase.from("staff_profiles").update({ signature_path: path }).eq("user_id", user.id);
  if (error) return { error: GENERIC_FAILURE };

  revalidatePath("/clinic/profile");
  return { saved: "Your signature has been saved." };
}

// Sign-in security ---------------------------------------------------------------------

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string(), confirm: z.string() })
  .refine((value) => value.next === value.confirm, { message: "The new passwords do not match.", path: ["confirm"] });

export async function changePassword(_state: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current") ?? "",
    next: formData.get("next") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!newPasswordSchema.safeParse({ password: parsed.data.next }).success) return { error: PASSWORD_RULES_MESSAGE };
  if (!(await allowAuthAttempt("password-change", user.email))) return { error: TRY_LATER };

  const supabase = await createClient();
  // The current password is checked again, so an unattended screen cannot change it.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (check.error) return { error: check.error.status === 429 ? TRY_LATER : "Your current password is not right." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you have not used on this account."
          : "We could not change your password. Please try again.",
    };
  }

  // Every other device is signed out, in case the old password was known to someone else.
  await supabase.auth.signOut({ scope: "others" });
  return { saved: "Your password has been changed. Other devices have been signed out." };
}

const changeEmailSchema = z.object({
  email: z.email("Enter an email address, like you@example.com."),
  password: z.string().min(1, "Enter your current password."),
});

export async function requestEmailChange(_state: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const parsed = changeEmailSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (parsed.data.email.toLowerCase() === user.email.toLowerCase()) {
    return { error: "That is already your email address." };
  }
  if (!(await allowAuthAttempt("email-change", user.email))) return { error: TRY_LATER };

  const supabase = await createClient();
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (check.error) return { error: check.error.status === 429 ? TRY_LATER : "Your current password is not right." };

  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  // The reply is the same whether or not the address is already in use, so this form cannot
  // be used to find out who has an account.
  if (error) console.error(`Email change request failed: ${error.status ?? "no status"} ${error.code ?? "no code"}.`);
  return { saved: "If that address can be used, we have sent a confirmation link to it. Follow the link to finish the change." };
}

export async function signOutOtherDevices(): Promise<ProfileFormState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: GENERIC_FAILURE };
  return { saved: "Every other device has been signed out." };
}

// Notifications ------------------------------------------------------------------------

export async function saveNotificationPreferences(
  _state: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("notification_preferences")
    .select("topic, channel, enabled")
    .eq("user_id", user.id);
  if (readError) return { error: GENERIC_FAILURE };
  const current = new Map(existing.map((row) => [`${row.topic}.${row.channel}`, row.enabled]));

  // An unticked box sends nothing, so a missing key means off. Each row is written only
  // if it differs, and only `enabled` can change on an existing row.
  const channels = isGhlConfigured() ? GHL_CHANNELS : BASE_CHANNELS;
  for (const topic of NOTIFICATION_TOPICS) {
    for (const channel of channels) {
      const key = `${topic}.${channel}`;
      const wanted = formData.has(key);
      const had = current.get(key);
      if (had === wanted) continue;
      if (had === undefined && wanted === defaultFor(channel)) {
        // A missing row already counts as the default, so only a change from it needs saving.
        continue;
      }
      const result =
        had === undefined
          ? await supabase.from("notification_preferences").insert({ user_id: user.id, topic, channel, enabled: wanted })
          : await supabase
              .from("notification_preferences")
              .update({ enabled: wanted })
              .eq("user_id", user.id)
              .eq("topic", topic)
              .eq("channel", channel);
      if (result.error) return { error: GENERIC_FAILURE };
    }
  }

  revalidatePath("/", "layout");
  return { saved: "Your notification choices have been saved." };
}
