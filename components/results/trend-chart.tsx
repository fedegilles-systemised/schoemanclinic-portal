import type { TrendPoint } from "@/lib/data/results";
import { formatDate } from "@/lib/format";

const W = 640;
const H = 260;
const PAD = { top: 24, right: 16, bottom: 32, left: 56 };

const DOT = {
  normal: "fill-secondary",
  borderline: "fill-status-warning",
  low: "fill-status-danger",
  high: "fill-status-danger",
  critical: "fill-status-danger",
} as const;

function label(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) < 10 ? 2 : 1);
}

/**
 * One marker over time, with the reference range as a band. Drawn on the server as plain SVG:
 * the values are in the table under it too, so the chart is never the only way to read them.
 */
export function TrendChart({
  points,
  refLow,
  refHigh,
  unit,
  name,
}: {
  points: TrendPoint[];
  refLow: number | null;
  refHigh: number | null;
  unit: string | null;
  name: string;
}) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, ...(refLow !== null ? [refLow] : []));
  const hi = Math.max(...values, ...(refHigh !== null ? [refHigh] : []));
  const span = hi - lo || Math.abs(hi) || 1;
  const min = lo - span * 0.1;
  const max = hi + span * 0.1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * plotH;
  const times = points.map((p) => new Date(`${p.date}T00:00:00Z`).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (i: number) => (t1 === t0 ? PAD.left + plotW / 2 : PAD.left + ((times[i] - t0) / (t1 - t0)) * plotW);

  const band = {
    top: y(refHigh ?? max),
    bottom: y(refLow ?? min),
  };
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${name} over time, from ${formatDate(first.date)} to ${formatDate(last.date)}. The values are listed below.`}
      className="block h-auto w-full"
    >
      {refLow !== null || refHigh !== null ? (
        <rect x={PAD.left} y={band.top} width={plotW} height={Math.max(band.bottom - band.top, 0)} className="fill-status-success-bg" />
      ) : null}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="stroke-surface-border" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="stroke-surface-border" />
      <text x={PAD.left - 8} y={y(hi) + 4} textAnchor="end" className="type-small fill-content-muted">
        {label(hi)}
      </text>
      <text x={PAD.left - 8} y={y(lo) + 4} textAnchor="end" className="type-small fill-content-muted">
        {label(lo)}
      </text>
      {unit ? (
        <text x={PAD.left - 8} y={PAD.top - 10} textAnchor="end" className="type-small fill-content-muted">
          {unit}
        </text>
      ) : null}
      <text x={PAD.left} y={H - 14} className="type-small fill-content-muted">
        {formatDate(first.date)}
      </text>
      {points.length > 1 ? (
        <text x={W - PAD.right} y={H - 14} textAnchor="end" className="type-small fill-content-muted">
          {formatDate(last.date)}
        </text>
      ) : null}
      {points.length > 1 ? <path d={path} fill="none" strokeWidth="1.5" className="stroke-secondary" /> : null}
      {points.map((p, i) => (
        <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.value)} r="4" className={DOT[p.flag ?? "normal"]} />
      ))}
    </svg>
  );
}
