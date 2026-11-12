/**
 * Removes hidden details from an image before it is stored for patients to see: a photo from a
 * phone can carry where and when it was taken and on which device. JPEG: the EXIF, XMP, IPTC and
 * comment segments are dropped, and colour profiles and the image data are kept. PNG: the
 * eXIf, tEXt, zTXt, iTXt and tIME chunks are dropped. Anything that does not parse is refused.
 */
export function stripImageMetadata(bytes: Uint8Array, type: "image/jpeg" | "image/png"): Uint8Array | null {
  return type === "image/jpeg" ? stripJpeg(bytes) : stripPng(bytes);
}

function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    // Start of scan: the rest is image data, kept as it is.
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      return concat(parts);
    }
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2 || i + 2 + length > bytes.length) return null;
    // APP1 (EXIF and XMP), APP13 (Photoshop and IPTC) and comments; colour profiles (APP2, APP14) stay.
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return null;
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((b, k) => bytes[k] === b)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const length = ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
    const end = i + 12 + length;
    if (end > bytes.length) return null;
    const name = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    if (!PNG_DROP.has(name)) parts.push(bytes.subarray(i, end));
    i = end;
    if (name === "IEND") return concat(parts);
  }
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
