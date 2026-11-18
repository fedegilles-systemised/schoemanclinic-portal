import { code39 } from "@/lib/orders/barcode";

/** The order's Code 39 barcode with the number underneath, for the person at the sample point. */
export function Barcode({ value }: { value: string }) {
  let geometry;
  try {
    geometry = code39(value);
  } catch {
    return <p className="type-body font-mono">{value}</p>;
  }
  const quiet = 10;
  return (
    <figure className="flex flex-col items-start gap-2">
      <svg
        role="img"
        aria-label={`Barcode ${value}`}
        viewBox={`0 0 ${geometry.width + quiet * 2} 60`}
        className="h-20 w-full max-w-sm bg-surface text-content"
        preserveAspectRatio="none"
      >
        {geometry.bars.map((bar) => (
          <rect key={bar.x} x={bar.x + quiet} y={0} width={bar.width} height={60} fill="currentColor" />
        ))}
      </svg>
      <figcaption className="type-body font-mono tracking-code">{value}</figcaption>
    </figure>
  );
}
