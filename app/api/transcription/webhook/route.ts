import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getTranscriptionEnv, isTranscriptionConfigured } from "@/lib/env";
import { completeRecording } from "@/lib/recordings/complete";
import { WEBHOOK_HEADER } from "@/lib/transcription/assemblyai";
import { createAdminClient } from "@/lib/supabase/admin";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * AssemblyAI calls this when a transcript is finished. It must carry our secret header; the body only
 * names the job, and the transcript itself is then fetched from AssemblyAI, so a forged call can at
 * most make us check a real job early.
 */
export async function POST(request: NextRequest) {
  if (!isTranscriptionConfigured()) return new NextResponse(null, { status: 404 });
  const secret = request.headers.get(WEBHOOK_HEADER) ?? "";
  if (!sameValue(secret, getTranscriptionEnv().TRANSCRIPTION_WEBHOOK_SECRET)) return new NextResponse(null, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { transcript_id?: string };
  if (!body.transcript_id || body.transcript_id.length > 100) return new NextResponse(null, { status: 400 });
  const { data } = await createAdminClient().from("call_recordings").select("id").eq("provider_job_id", body.transcript_id).maybeSingle();
  if (!data) return new NextResponse(null, { status: 200 });
  try {
    const outcome = await completeRecording(data.id);
    // Still working, or a failure on our side: answer with an error so the service tries again later.
    if (outcome === "working") return new NextResponse(null, { status: 503 });
  } catch {
    console.error("Transcript not collected from the webhook; the service will retry, or it can be checked from the record.");
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
