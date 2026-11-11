/** The largest file a person may send: a PDF letter or a photo of one. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type AllowedFileType = "application/pdf" | "image/jpeg" | "image/png";

/** Checks the first bytes, so a file's name or declared type is not taken on trust. */
export function fileKind(bytes: Uint8Array): AllowedFileType | null {
  const head = (n: number) => Array.from(bytes.slice(0, n));
  const text = String.fromCharCode(...head(5));
  if (text === "%PDF-") return "application/pdf";
  const h = head(4);
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return "image/jpeg";
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return "image/png";
  return null;
}

export function extensionFor(type: AllowedFileType): "pdf" | "png" | "jpg" {
  return type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : "jpg";
}
