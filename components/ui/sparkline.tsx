import { cn } from "@/lib/utils";

type SparklineProps = {
  values: number[];
  tone?: "default" | "warning" | "danger";
  width?: number;
  height?: number;
  className?: string;
};

const DOT_CLASS = {
  default: "fill-secondary",
  warning: "fill-status-warning",
  danger: "fill-status-danger",
} as const;

/** 96 by 28, 1.5px secondary line, last point in the status colour. Decorative. */
function Sparkline({ values, tone = "default", width = 96, height = 28, className }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 2 + (i * (width - 4)) / (values.length - 1);
  const y = (v: number) => 3 + ((max - v) / span) * (height - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;

  return (
    <svg
      data-slot="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("block shrink-0", className)}
    >
      <path d={d} fill="none" strokeWidth="1.5" className="stroke-secondary" />
      <circle cx={x(last)} cy={y(values[last])} r="3" className={DOT_CLASS[tone]} />
    </svg>
  );
}

export { Sparkline };
