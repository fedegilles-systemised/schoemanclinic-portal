import "server-only";

import type { Database } from "@/lib/database.types";
import { addDays, daysBetween, londonDate, londonDayStart } from "@/lib/format";
import { isOutOfRange } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";

type ResultFlag = Database["public"]["Enums"]["result_flag"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

export type AttentionRow = {
  reportId: string;
  patientName: string;
  panelName: string;
  markerName: string;
  value: number | string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: ResultFlag | null;
  previous: number | null;
  receivedAt: string;
};

export type DiaryRow = {
  id: string;
  startsAt: string;
  durationMin: number;
  type: string;
  patientName: string;
  clinicRef: string;
  locationName: string | null;
  locationKind: Database["public"]["Enums"]["location_kind"] | null;
  flag: "result_to_review" | "bloods_missing" | null;
};

export type RiskCard = {
  appointmentId: string;
  patientName: string;
  startsAt: string;
  orderStatus: OrderStatus;
  panelName: string;
  sampleTakenAt: string | null;
  daysToDue: number | null;
};

export type ClinicHome = {
  todayCount: number;
  nextToday: { startsAt: string; patientName: string } | null;
  toReviewCount: number;
  toReviewOutOfRange: number;
  importsWaiting: number;
  attention: AttentionRow[];
  diary: DiaryRow[];
  risks: RiskCard[];
};

const RISK_WINDOW_DAYS = 14;
const OPEN_ORDER: OrderStatus[] = ["sent_to_patient", "paid", "sample_taken"];

function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`;
}

/**
 * Everything on the clinic home, read through the signed-in person's session, so each
 * role sees what row-level security allows: an admin sees no patients, and a health
 * coach sees no unreleased results.
 */
export async function getClinicHome(locationId: string | null): Promise<ClinicHome> {
  const supabase = await createClient();
  const today = londonDate();
  const dayStart = londonDayStart(today).toISOString();
  const dayEnd = londonDayStart(addDays(today, 1)).toISOString();
  const riskEnd = londonDayStart(addDays(today, RISK_WINDOW_DAYS + 1)).toISOString();

  let diaryQuery = supabase
    .from("appointments")
    .select(
      "id, starts_at, duration_min, type, patient_id, patient:patient_profiles!inner(first_name, last_name, clinic_ref), location:locations(name, kind), lab_orders(status)",
    )
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .in("status", ["booked", "confirmed", "completed"])
    .order("starts_at");
  if (locationId) diaryQuery = diaryQuery.eq("location_id", locationId);

  const [diary, reports, imports, risks] = await Promise.all([
    diaryQuery,
    supabase
      .from("lab_reports")
      .select(
        "id, patient_id, sample_date, received_at, patient:patient_profiles!inner(first_name, last_name), order:lab_orders(panel:lab_panels(name)), results(value_numeric, value_text, unit, ref_low, ref_high, flag, marker_id, marker:markers!inner(name))",
      )
      .eq("status", "awaiting_review")
      .order("received_at", { ascending: false }),
    supabase
      .from("result_imports")
      .select("id", { count: "exact", head: true })
      .in("status", ["needs_match", "matched"]),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, patient:patient_profiles!inner(first_name, last_name), lab_orders!inner(status, due_by, sample_taken_at, panel:lab_panels(name))",
      )
      .gte("starts_at", dayStart)
      .lt("starts_at", riskEnd)
      .in("status", ["booked", "confirmed"])
      .in("lab_orders.status", OPEN_ORDER)
      .order("starts_at"),
  ]);

  const failed = [diary, reports, imports, risks].find((r) => r.error);
  if (failed) throw new Error("Could not load the clinic home.");

  const reportRows = reports.data ?? [];
  const patientIds = [...new Set(reportRows.map((r) => r.patient_id))];

  // The value before this report, for each marker in the queue.
  const previous = patientIds.length
    ? await supabase
        .from("results")
        .select("patient_id, marker_id, value_numeric, report:lab_reports!inner(sample_date, released_at)")
        .in("patient_id", patientIds)
        .not("report.released_at", "is", null)
    : null;
  if (previous?.error) throw new Error("Could not load previous results.");

  const attention = reportRows.flatMap((report): AttentionRow[] => {
    // The row shows the marker that matters most: the first out of range, or the first.
    const shown = report.results.find((r) => isOutOfRange(r.flag)) ?? report.results[0];
    if (!shown) return [];
    const earlier = (previous?.data ?? [])
      .filter(
        (r) =>
          r.patient_id === report.patient_id &&
          r.marker_id === shown.marker_id &&
          (r.report.sample_date ?? "") < (report.sample_date ?? ""),
      )
      .sort((a, b) => (b.report.sample_date ?? "").localeCompare(a.report.sample_date ?? ""))[0];
    return [
      {
        reportId: report.id,
        patientName: fullName(report.patient),
        panelName: report.order?.panel.name ?? "External results",
        markerName: shown.marker.name,
        value: shown.value_numeric ?? shown.value_text ?? "",
        unit: shown.unit,
        refLow: shown.ref_low,
        refHigh: shown.ref_high,
        flag: shown.flag,
        previous: earlier?.value_numeric ?? null,
        receivedAt: report.received_at,
      },
    ];
  });

  const patientsToReview = new Set(reportRows.map((r) => r.patient_id));

  const diaryRows = (diary.data ?? []).map((row): DiaryRow => {
    const openOrder = row.lab_orders.some((o) => o.status === "sent_to_patient" || o.status === "paid");
    return {
      id: row.id,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      type: row.type,
      patientName: fullName(row.patient),
      clinicRef: row.patient.clinic_ref,
      locationName: row.location?.name ?? null,
      locationKind: row.location?.kind ?? null,
      flag: openOrder ? "bloods_missing" : patientsToReview.has(row.patient_id) ? "result_to_review" : null,
    };
  });

  const now = new Date().toISOString();
  const next = diaryRows.find((row) => row.startsAt >= now) ?? null;

  return {
    todayCount: diaryRows.length,
    nextToday: next ? { startsAt: next.startsAt, patientName: next.patientName } : null,
    toReviewCount: reportRows.length,
    toReviewOutOfRange: reportRows.filter((r) => r.results.some((x) => isOutOfRange(x.flag))).length,
    importsWaiting: imports.count ?? 0,
    attention,
    diary: diaryRows,
    risks: (risks.data ?? []).map((row): RiskCard => {
      const order = row.lab_orders[0];
      return {
        appointmentId: row.id,
        patientName: fullName(row.patient),
        startsAt: row.starts_at,
        orderStatus: order.status,
        panelName: order.panel.name,
        sampleTakenAt: order.sample_taken_at,
        daysToDue: order.due_by ? daysBetween(today, order.due_by) : null,
      };
    }),
  };
}

/** Counts for the sidebar. */
export async function getClinicNavCounts(): Promise<{ review: number; imports: number }> {
  const supabase = await createClient();
  const [review, imports] = await Promise.all([
    supabase.from("lab_reports").select("id", { count: "exact", head: true }).eq("status", "awaiting_review"),
    supabase.from("result_imports").select("id", { count: "exact", head: true }).in("status", ["needs_match", "matched"]),
  ]);
  return { review: review.count ?? 0, imports: imports.count ?? 0 };
}
