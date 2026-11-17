/**
 * Code 39, the barcode on the electronic request. Each character is nine elements (bar, space, bar...),
 * three of them wide. Only the characters an order number uses are listed; anything else throws, so a
 * wrong barcode is never drawn.
 */
const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  H: "wnnnnwwnn",
  L: "nnwnnnnww",
  O: "wnnnwnnwn",
  S: "nnwnnnwwn",
  "-": "nwnnnnwnw",
  "*": "nwnnwnwnn",
};

const NARROW = 1;
const WIDE = 3;

export type BarcodeGeometry = { bars: { x: number; width: number }[]; width: number };

export function code39(text: string): BarcodeGeometry {
  const upper = text.toUpperCase();
  const bars: { x: number; width: number }[] = [];
  let x = 0;
  for (const char of `*${upper}*`) {
    const pattern = PATTERNS[char];
    if (!pattern) throw new Error("This character cannot be drawn as a Code 39 barcode.");
    for (let i = 0; i < pattern.length; i += 1) {
      const width = pattern[i] === "w" ? WIDE : NARROW;
      if (i % 2 === 0) bars.push({ x, width });
      x += width;
    }
    x += NARROW; // the gap between characters
  }
  return { bars, width: x - NARROW };
}
