import type { Database } from "@/lib/database.types";

export type WearableMetric = Database["public"]["Enums"]["wearable_metric"];

/** What a patient can type in from their device, with the unit shown and a sensible range. */
export const WEARABLE_METRICS: Record<WearableMetric, { label: string; unit: string; min: number; max: number }> = {
  sleep_minutes: { label: "Sleep", unit: "minutes", min: 0, max: 1440 },
  sleep_score: { label: "Sleep score", unit: "score", min: 0, max: 100 },
  readiness_score: { label: "Readiness or recovery", unit: "score", min: 0, max: 100 },
  resting_heart_rate: { label: "Resting heart rate", unit: "bpm", min: 20, max: 200 },
  hrv_ms: { label: "Heart rate variability", unit: "ms", min: 0, max: 400 },
  steps: { label: "Steps", unit: "steps", min: 0, max: 200000 },
  active_minutes: { label: "Active minutes", unit: "minutes", min: 0, max: 1440 },
  weight_kg: { label: "Weight", unit: "kg", min: 2, max: 400 },
  body_fat_percent: { label: "Body fat", unit: "%", min: 1, max: 80 },
  vo2_max: { label: "VO2 max", unit: "ml/kg/min", min: 5, max: 100 },
  spo2_percent: { label: "Blood oxygen", unit: "%", min: 50, max: 100 },
  temperature_deviation_c: { label: "Temperature change", unit: "°C", min: -5, max: 5 },
};

export const WEARABLE_METRIC_KEYS = Object.keys(WEARABLE_METRICS) as WearableMetric[];
