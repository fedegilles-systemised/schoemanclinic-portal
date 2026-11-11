"use client";

import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { checkRecording, sendForTranscription, startRecordingUpload } from "@/lib/recordings/actions";

const MAX_BYTES = 50 * 1024 * 1024;
const FORMATS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

type Phase = "idle" | "recording" | "uploading" | "done";

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Records a call from the patient's record: the microphone, plus the call's own sound when the call
 * runs in a browser tab that is shared with its audio. The audio goes straight to private storage,
 * then to transcription; the transcript comes back as a draft note.
 */
export function Recorder({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"call" | "room">("call");
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<{ error?: string; saved?: string }>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const streams = useRef<MediaStream[]>([]);
  const context = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  function release() {
    streams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    streams.current = [];
    void context.current?.close();
    context.current = null;
  }

  async function start() {
    setMessage({});
    const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    if (!format) {
      setMessage({ error: "This browser cannot record audio. Use Chrome or Edge." });
      return;
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.current = [mic];
      const ctx = new AudioContext();
      context.current = ctx;
      const mix = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(mic).connect(mix);
      if (mode === "call") {
        const shared = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.current.push(shared);
        if (shared.getAudioTracks().length === 0) {
          release();
          setMessage({ error: "No call sound was shared. Choose the tab with the call and tick \"Share tab audio\", or record the microphone only." });
          return;
        }
        ctx.createMediaStreamSource(new MediaStream(shared.getAudioTracks())).connect(mix);
        // If the person stops sharing from the browser's own bar, finish the recording.
        shared.getVideoTracks()[0]?.addEventListener("ended", () => stop());
      }
      chunks.current = [];
      const rec = new MediaRecorder(mix.stream, { mimeType: format, audioBitsPerSecond: 32000 });
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => void upload(new Blob(chunks.current, { type: format.split(";")[0] }), format);
      rec.start(10_000);
      recorder.current = rec;
      setSeconds(0);
      setPhase("recording");
    } catch {
      release();
      setMessage({ error: "Recording could not start. Allow the microphone (and screen sharing for a call) when the browser asks." });
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    release();
  }

  async function upload(audio: Blob, format: string) {
    setPhase("uploading");
    if (audio.size > MAX_BYTES) {
      setPhase("idle");
      setMessage({ error: "This recording is over 50 MB, which is too long to send. Split long calls into parts." });
      return;
    }
    const opened = await startRecordingUpload(patientId, format);
    if ("error" in opened) {
      setPhase("idle");
      setMessage({ error: opened.error });
      return;
    }
    const put = await fetch(opened.uploadUrl, { method: "PUT", body: audio, headers: { "Content-Type": audio.type, "x-upsert": "false" } }).catch(() => null);
    if (!put?.ok) {
      setPhase("idle");
      setMessage({ error: "The recording could not be uploaded. Check the connection and record again." });
      return;
    }
    const sent = await sendForTranscription(opened.recordingId);
    setPhase("done");
    setMessage(sent.error ? { error: sent.error } : { saved: "Saved. The transcript will appear below as a draft note in a few minutes." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {phase === "idle" || phase === "done" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-col gap-1.5">
            <Label htmlFor="record-mode">What to record</Label>
            <Select id="record-mode" value={mode} onChange={(event) => setMode(event.target.value as "call" | "room")}>
              <option value="call">My microphone and the call (video call in a browser tab)</option>
              <option value="room">My microphone only (patient in the room, or a phone call on speaker)</option>
            </Select>
          </div>
          <Button type="button" onClick={() => void start()}>
            <Mic aria-hidden />
            Start recording
          </Button>
        </div>
      ) : null}
      {phase === "recording" ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="type-value tabular-nums">
            Recording {clock(seconds)}
          </span>
          <Button type="button" onClick={stop}>
            <Square aria-hidden />
            Stop and save
          </Button>
        </div>
      ) : null}
      {phase === "uploading" ? <p className="type-small text-content-muted">Saving the recording. Keep this page open.</p> : null}
      <p className="type-small text-content-muted">
        Tell the patient you are recording. For a video call, share the call&apos;s tab with &quot;Share tab audio&quot; ticked. The audio is kept privately: only staff
        who can open this record can reach it, and a short-lived link is sent to the transcription service (AssemblyAI, EU).
      </p>
      <FormMessage state={message} />
    </div>
  );
}

export function CheckRecordingButton({ recordingId, patientId, failed }: { recordingId: string; patientId: string; failed: boolean }) {
  const [state, action, pending] = useActionState(checkRecording, {});
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="recordingId" value={recordingId} />
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {failed ? "Send again" : "Check now"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
