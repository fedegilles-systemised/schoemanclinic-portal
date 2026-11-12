import "server-only";

import type { Database } from "@/lib/database.types";
import { daysBetween, londonDate } from "@/lib/format";
import { getPortalPatient, type PortalRecord } from "@/lib/portal/patient";
import { RUN_OUT_WARNING_DAYS } from "@/lib/prescriptions/constants";
import { createClient } from "@/lib/supabase/server";

type PatientRecord = PortalRecord;
type ResultFlag = Database["public"]["Enums"]["result_flag"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

export type MarkerGlance = {
  code: string;
  name: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: ResultFlag | null;
  latest: number | string;
  history: number[];
};

export type PortalHome = {
  patient: PatientRecord;
  appointment: {
    startsAt: string;
    durationMin: number;
    type: string;
    locationName: string | null;
    clinicianName: string | null;
  } | null;
  bloods: {
    panelName: string;
    dueBy: string | null;
    status: OrderStatus;
  } | null;
  latestReport: {
    resultCount: number;
    reviewedAt: string | null;
    reviewerName: string | null;
    commentedMarkers: string[];
  } | null;
  glance: MarkerGlance[];
  letter: { title: string; createdAt: string; authorName: string | null } | null;
  runningLow: { name: string; daysLeft: number } | null;
};

// The home card warns three weeks ahead, like the reminder email (agreed on 6 November 2026).
const LOW_SUPPLY_DAYS = RUN_OUT_WARNING_DAYS;
const GLANCE_COUNT = 4;

// Row-level security already limits these reads. A doctor who is also a patient is a
// clinical reader too, so every query also says "this patient, released only" itself.
export async function getPortalHome(): Promise<PortalHome | null> {
  const supabase = await createClient();

  const patient = await getPortalPatient();
  if (!patient) return null;

  const [directory, appointments, orders, results, letters, medications] = await Promise.all([
    supabase.rpc("get_staff_directory"),
    supabase
      .from("appointments")
      .select("starts_at, duration_min, type, clinician_id, location:locations(name)")
      .eq("patient_id", patient.id)
      .in("status", ["booked", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1),
    supabase
      .from("lab_orders")
      .select("status, due_by, panel:lab_panels(name)")
      .eq("patient_id", patient.id)
      .in("status", ["sent_to_patient", "paid", "sample_taken"])
      .order("due_by")
      .limit(1),
    supabase
      .from("results")
      .select(
        "value_numeric, value_text, unit, ref_low, ref_high, flag, doctor_comment, lab_report_id, marker:markers!inner(code, name, unit), report:lab_reports!inner(sample_date, reviewed_at, reviewed_by, released_at)",
      )
      .eq("patient_id", patient.id)
      .not("report.released_at", "is", null),
    supabase
      .from("documents")
      .select("title, created_at, uploaded_by")
      .eq("patient_id", patient.id)
      .eq("kind", "letter")
      .eq("shared_with_patient", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("medications")
      .select("name, start_date, supply_days")
      .eq("patient_id", patient.id)
      .eq("status", "active")
      .is("archived_at", null),
  ]);

  const failed = [directory, appointments, orders, results, letters, medications].find((r) => r.error);
  if (failed) throw new Error("Could not load your home screen.");

  const staff = directory.data ?? [];
  const staffByStaffId = new Map(staff.map((s) => [s.staff_id, s.full_name]));
  const staffByProfileId = new Map(staff.map((s) => [s.profile_id, s.full_name]));

  const nextAppointment = appointments.data?.[0];
  const order = orders.data?.[0];
  const letter = letters.data?.[0];

  // Newest sample first, then oldest to newest for each marker's trend.
  const rows = [...(results.data ?? [])].sort((a, b) =>
    (a.report.sample_date ?? "").localeCompare(b.report.sample_date ?? ""),
  );
  const newest = rows[rows.length - 1];
  const newestRows = newest ? rows.filter((r) => r.lab_report_id === newest.lab_report_id) : [];

  const byMarker = new Map<string, typeof rows>();
  for (const row of rows) {
    byMarker.set(row.marker.code, [...(byMarker.get(row.marker.code) ?? []), row]);
  }

  const glance = [...byMarker.values()]
    .map((history): MarkerGlance => {
      const last = history[history.length - 1];
      return {
        code: last.marker.code,
        name: last.marker.name,
        unit: last.unit ?? last.marker.unit,
        refLow: last.ref_low,
        refHigh: last.ref_high,
        flag: last.flag,
        latest: last.value_numeric ?? last.value_text ?? "",
        history: history.flatMap((r) => (r.value_numeric === null ? [] : [r.value_numeric])),
      };
    })
    // What needs attention first, then by name.
    .sort((a, b) => rank(a.flag) - rank(b.flag) || a.name.localeCompare(b.name))
    .slice(0, GLANCE_COUNT);

  const today = londonDate();
  const runningLow = (medications.data ?? [])
    .map((m) => ({
      name: m.name,
      daysLeft: m.supply_days - daysBetween(m.start_date, today),
    }))
    .filter((m) => m.daysLeft <= LOW_SUPPLY_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return {
    patient,
    appointment: nextAppointment
      ? {
          startsAt: nextAppointment.starts_at,
          durationMin: nextAppointment.duration_min,
          type: nextAppointment.type,
          locationName: nextAppointment.location?.name ?? null,
          clinicianName: nextAppointment.clinician_id
            ? (staffByStaffId.get(nextAppointment.clinician_id) ?? null)
            : null,
        }
      : null,
    bloods: order
      ? {
          panelName: order.panel.name,
          dueBy: order.due_by,
          status: order.status,
        }
      : null,
    latestReport: newest
      ? {
          resultCount: newestRows.length,
          reviewedAt: newest.report.reviewed_at,
          reviewerName: newest.report.reviewed_by
            ? (staffByStaffId.get(newest.report.reviewed_by) ?? null)
            : null,
          commentedMarkers: newestRows.filter((r) => r.doctor_comment).map((r) => r.marker.name),
        }
      : null,
    glance,
    letter: letter
      ? {
          title: letter.title,
          createdAt: letter.created_at,
          authorName: letter.uploaded_by ? (staffByProfileId.get(letter.uploaded_by) ?? null) : null,
        }
      : null,
    runningLow: runningLow ?? null,
  };
}

function rank(flag: ResultFlag | null): number {
  if (flag === "normal" || flag === null) return 2;
  if (flag === "borderline") return 1;
  return 0;
}
