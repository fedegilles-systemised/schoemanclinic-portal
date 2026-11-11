import "server-only";

import { fetchTranscript } from "@/lib/transcription/assemblyai";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Collects a finished transcript and saves it as a draft note in the recorder's name. Safe to call
 * more than once: the database writes the note only the first time.
 */
export async function completeRecording(recordingId: string): Promise<"done" | "working" | "failed"> {
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("call_recordings")
    .select("id, status, provider_job_id, created_at")
    .eq("id", recordingId)
    .maybeSingle();
  if (!r?.provider_job_id) return "failed";
  if (r.status === "transcribed") return "done";
  const transcript = await fetchTranscript(r.provider_job_id);
  if (transcript.state === "working") return "working";
  if (transcript.state === "failed") {
    await admin.rpc("recording_failed", { _recording: r.id, _error: transcript.error });
    return "failed";
  }
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(r.created_at));
  const { error } = await admin.rpc("recording_transcribed", {
    _recording: r.id,
    _title: `Call recording, ${when}`,
    _body: `Transcript of a recorded call. Check it, edit it into the note you want to keep, then sign it.\n\n${transcript.text}`,
  });
  return error ? "failed" : "done";
}
