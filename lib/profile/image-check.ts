/** The image types the profile accepts, with the first bytes each must start with. */
const SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // RIFF....WEBP, checked in two parts below.
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** True if the bytes really are the type the browser claimed. The declared type alone is not trusted. */
export function bytesMatchType(bytes: Uint8Array, type: string): boolean {
  const patterns = SIGNATURES[type];
  if (!patterns) return false;
  const starts = patterns.some((pattern) => pattern.every((value, index) => bytes[index] === value));
  if (!starts) return false;
  if (type === "image/webp") {
    return bytes.length > 12 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return true;
}
