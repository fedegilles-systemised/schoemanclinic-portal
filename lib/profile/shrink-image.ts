/** Runs in the browser only: it uses the canvas. */

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export type ShrinkResult = { file: File } | { error: string };

/**
 * Returns the image as it is if it already fits, otherwise a smaller JPEG on a white ground.
 * Phone photos are often 4 to 8 MB, and the server takes 2 MB at most for a photo.
 */
export async function shrinkImage(
  file: File,
  { maxBytes, maxSide }: { maxBytes: number; maxSide: number },
): Promise<ShrinkResult> {
  if (!ALLOWED.includes(file.type)) return { error: "Use a JPEG, PNG or WebP image. A photo in HEIC format must be saved as JPEG first." };
  if (file.size <= maxBytes) return { file };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { error: "We could not read that image. Try a different one." };
  }

  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  let quality = 0.88;
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) break;
    // A white ground, so a transparent image does not turn black as a JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) {
      bitmap.close();
      return { file: new File([blob], "image.jpg", { type: "image/jpeg" }) };
    }
    scale *= 0.8;
    quality = Math.max(0.6, quality - 0.08);
  }
  bitmap.close();
  return { error: "That image is too large. Choose a smaller one." };
}
