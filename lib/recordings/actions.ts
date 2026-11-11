"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId } from "@/lib/data/patient-record";
import { isTranscriptionConfigured } from "@/lib/env";
import { completeRecording } from "@/lib/recordings/complete";
import { submitTranscription } from "@/lib/transcription/assemblyai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const WRITERS = ["doctor", "nurse", "health_coach"] as const;
const AUDIO_TYPES = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a" } as const;

export type StartUpload = { error: string } | { recordingId: string; uploadUrl: string };

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (WRITERS as readonly string[]).includes(role))) return null;
  const staffId = await getMyStaffId(user.id);
  return staffId ? { user, staffId } : null;
}

/**
 * Opens a recording: a row for the patient and a one-off link the browser uploads the audio to, straight
 * into private storage. Row-level security decides whether this person may record this patient.
 */
export async function startRecordingUpload(patientId: string, mimeType: string): Promise<StartUpload> {
  const me = await requireWriter();
  if (!me) return { error: "Only doctors, nurses and health coaches record calls." };
  if (!isTranscriptionConfigured()) return { error: "Call recording is not set up yet." };
  const patient = z.uuid().safeParse(patientId);
  const baseType = mimeType.split(";")[0] as keyof typeof AUDIO_TYPES;
  if (!patient.success || !(baseType in AUDIO_TYPES)) return { error: "This browser's recording format is not supported." };
  const path = `${patient.data}/${randomUUID()}.${AUDIO_TYPES[baseType]}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_recordings")
    .insert({ patient_id: patient.data, recorded_by: me.staffId, storage_path: path })
    .select("id")
    .single();
  if (error) return { error: "You can record only the calls of patients you look after." };
  const upload = await supabase.storage.from("recordings").createSignedUploadUrl(path);
  if (upload.error) return { error: "The recording could not be prepared. Please try again." };
  return { recordingId: data.id, uploadUrl: upload.data.signedUrl };
}

/** After the upload: sends a short-lived link to the audio for transcription. */
export async function sendForTranscription(recordingId: string): Promise<{ error?: string }> {
  const me = await requireWriter();
  if (!me) return { error: "Only doctors, nurses and health coaches record calls." };
  const id = z.uuid().safeParse(recordingId);
  if (!id.success) return { error: "That recording was not found." };
  // Read through the person's own session first, so only someone who can open the record sends it.
  const supabase = await createClient();
  const own = await supabase.from("call_recordings").select("id, patient_id, storage_path, recorded_by").eq("id", id.data).maybeSingle();
  if (own.error || !own.data || own.data.recorded_by !== me.staffId) return { error: "That recording was not found." };
  const admin = createAdminClient();
  try {
    const link = await admin.storage.from("recordings").createSignedUrl(own.data.storage_path, 30 * 60);
    if (link.error) throw new Error("No link to the audio");
    const job = await submitTranscription(link.data.signedUrl);
    await admin.rpc("recording_sent", { _recording: own.data.id, _job: job });
  } catch (error) {
    await admin.rpc("recording_failed", { _recording: own.data.id, _error: error instanceof Error ? error.message : "Not sent" });
    return { error: "The recording is saved, but could not be sent for transcription. Try again from the list." };
  }
  revalidatePath(`/clinic/patients/${own.data.patient_id}`);
  return {};
}

/** Checks on a transcript by hand, for when the service's notice has not arrived. */
export async function checkRecording(_state: { error?: string; saved?: string }, formData: FormData): Promise<{ error?: string; saved?: string }> {
  const me = await requireWriter();
  if (!me) return { error: "Only doctors, nurses and health coaches record calls." };
  const id = z.uuid().safeParse(formData.get("recordingId"));
  const patientId = z.uuid().safeParse(formData.get("patientId"));
  if (!id.success || !patientId.success) return { error: "That recording was not found." };
  const supabase = await createClient();
  const own = await supabase.from("call_recordings").select("id, status").eq("id", id.data).maybeSingle();
  if (!own.data) return { error: "That recording was not found." };
  if (own.data.status === "failed") {
    const resent = await sendForTranscription(id.data);
    return resent.error ? { error: resent.error } : { saved: "Sent for transcription again." };
  }
  const outcome = await completeRecording(id.data);
  revalidatePath(`/clinic/patients/${patientId.data}`);
  if (outcome === "done") return { saved: "The transcript is ready as a draft note." };
  if (outcome === "working") return { saved: "Still being transcribed. It usually takes a few minutes." };
  return { error: "The transcription failed. Use Send again to try once more." };
}
