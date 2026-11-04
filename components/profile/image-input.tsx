"use client";

import { useRef, useState } from "react";

import { shrinkImage } from "@/lib/profile/shrink-image";

/**
 * A file field for a photo or a signature. A large image is made smaller here, before it is
 * sent, so a phone photo does not hit the server's size limit. `onBusyChange` lets the form
 * hold its button while that happens.
 */
export function ImageInput({
  name,
  label,
  maxBytes,
  maxSide,
  onBusyChange,
}: {
  name: string;
  label: string;
  maxBytes: number;
  maxSide: number;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setNote(null);
    if (!file) return;

    onBusyChange(true);
    const result = await shrinkImage(file, { maxBytes, maxSide });
    onBusyChange(false);

    if ("error" in result) {
      // Clear the field, so the form cannot send the file that was refused.
      if (input.current) input.current.value = "";
      setNote({ tone: "error", text: result.error });
      return;
    }
    if (result.file !== file && input.current) {
      const transfer = new DataTransfer();
      transfer.items.add(result.file);
      input.current.files = transfer.files;
      setNote({ tone: "ok", text: `The image was made smaller to fit (${Math.round(result.file.size / 1024)} KB).` });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        required
        aria-label={label}
        onChange={onChange}
        className="type-small text-content-muted file:mr-3 file:border file:border-surface-border file:bg-surface-raised file:px-3 file:py-2 file:text-content"
      />
      {note ? (
        <p role={note.tone === "error" ? "alert" : "status"} className={note.tone === "error" ? "type-small text-status-danger" : "type-small text-content-muted"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
