import "server-only";

import { getTranscriptionEnv } from "@/lib/env";

/**
 * AssemblyAI, EU region. Clinic Hub sends a short-lived link to the audio, never the audio itself, and
 * asks for speakers to be told apart and for British English. The finished transcript is announced to
 * our webhook with a secret header, then fetched here.
 */

const BASE = "https://api.eu.assemblyai.com/v2";
const TIMEOUT_MS = 15_000;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const env = getTranscriptionEnv();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: env.ASSEMBLYAI_API_KEY, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) throw new Error(`Transcription service refused ${path.split("/")[1]} (${response.status})`);
  return json;
}

export const WEBHOOK_HEADER = "x-clinic-hub-secret";

export async function submitTranscription(audioUrl: string): Promise<string> {
  const env = getTranscriptionEnv();
  const result = await call<{ id?: string }>("/transcript", {
    method: "POST",
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      language_code: "en_uk",
      punctuate: true,
      format_text: true,
      webhook_url: `${env.SITE_URL.replace(/\/$/, "")}/api/transcription/webhook`,
      webhook_auth_header_name: WEBHOOK_HEADER,
      webhook_auth_header_value: env.TRANSCRIPTION_WEBHOOK_SECRET,
    }),
  });
  if (!result.id) throw new Error("Transcription service returned no job id");
  return result.id;
}

export type Transcript =
  | { state: "working" }
  | { state: "failed"; error: string }
  | { state: "done"; text: string };

/**
 * Deletes the transcript and its audio at AssemblyAI once Clinic Hub has its own copy, so no recorded
 * consultation stays with the processor. Best effort: a failure is logged and can be retried.
 */
export async function deleteTranscription(jobId: string): Promise<boolean> {
  try {
    await call(`/transcript/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    return true;
  } catch {
    console.error("Transcript not yet deleted at the transcription service.");
    return false;
  }
}

/** The transcript as lines like "Speaker A: ...", or its state if it is not ready. */
export async function fetchTranscript(jobId: string): Promise<Transcript> {
  const result = await call<{
    status?: string;
    error?: string;
    text?: string;
    utterances?: { speaker: string; text: string }[] | null;
  }>(`/transcript/${encodeURIComponent(jobId)}`);
  if (result.status === "error") return { state: "failed", error: result.error ?? "The transcription failed." };
  if (result.status !== "completed") return { state: "working" };
  const text = result.utterances?.length
    ? result.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n\n")
    : (result.text ?? "");
  return { state: "done", text: text.trim() || "(Nothing was heard in this recording.)" };
}
