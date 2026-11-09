import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type ResultFlag = Database["public"]["Enums"]["result_flag"];
type ReportStatus = Database["public"]["Enums"]["report_status"];
type ImportStatus = Database["public"]["Enums"]["import_status"];

function fullName(p: { first_name: string; last_name: string } | null): string {
  return p ? `${p.first_name} ${p.last_name}` : "Not matched yet";
}

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// The clinic's side ---------------------------------------------------------------------------------

export type ReportRow = {
  id: string;
  patientName: string;
  clinicRef: string;
  labName: string | null;
  sampleDate: string | null;
  receivedAt: string;
  releasedAt: string | null;
  status: ReportStatus;
  resultCount: number;
  outOfRangeCount: number;
};

export type ImportRow = {
  id: string;
  title: string;
  patientName: string;
  matched: boolean;
  receivedAt: string;
  status: ImportStatus;
};

export type ResultsQueue = { awaiting: ReportRow[]; released: ReportRow[]; imports: ImportRow[] };

const OUT_OF_RANGE: ResultFlag[] = ["low", "high", "critical"];

type ReportQueryRow = {
  id: string;
  external_lab_name: string | null;
  sample_date: string | null;
  received_at: string;
  released_at: string | null;
  status: ReportStatus;
  patient: { first_name: string; last_name: string; clinic_ref: string } | null;
  results: { flag: ResultFlag | null }[];
};

function toReportRow(row: ReportQueryRow): ReportRow {
  return {
    id: row.id,
    patientName: fullName(row.patient),
    clinicRef: row.patient?.clinic_ref ?? "",
    labName: row.external_lab_name,
    sampleDate: row.sample_date,
    receivedAt: row.received_at,
    releasedAt: row.released_at,
    status: row.status,
    resultCount: row.results.length,
    outOfRangeCount: row.results.filter((r) => r.flag && OUT_OF_RANGE.includes(r.flag)).length,
  };
}

const REPORT_COLUMNS =
  "id, external_lab_name, sample_date, received_at, released_at, status, patient:patient_profiles(first_name, last_name, clinic_ref), results(flag)";

/** What is waiting, in the order it arrived. Row-level security decides what each role may see. */
export async function getResultsQueue(): Promise<ResultsQueue> {
  const supabase = await createClient();
  const [awaiting, released, imports] = await Promise.all([
    supabase.from("lab_reports").select(REPORT_COLUMNS).eq("status", "awaiting_review").order("received_at"),
    supabase.from("lab_reports").select(REPORT_COLUMNS).eq("status", "released").order("released_at", { ascending: false }).limit(20),
    supabase
      .from("result_imports")
      .select("id, status, received_at, patient:patient_profiles(first_name, last_name), document:documents(title)")
      .in("status", ["needs_match", "matched"])
      .order("received_at"),
  ]);
  if (awaiting.error || released.error || imports.error) throw new Error("Could not load results.");
  return {
    awaiting: awaiting.data.map(toReportRow),
    released: released.data.map(toReportRow),
    imports: imports.data.map((row) => ({
      id: row.id,
      title: row.document?.title ?? "File",
      patientName: fullName(row.patient),
      matched: row.patient !== null,
      receivedAt: row.received_at,
      status: row.status,
    })),
  };
}

export type EntryOptions = {
  patients: { id: string; name: string; clinicRef: string }[];
  markers: { id: string; name: string; code: string; unit: string | null; otherUnits: string[] }[];
};

/** Patients and markers for the entry form. A marker's other units are the ones the database can convert. */
export async function getEntryOptions(): Promise<EntryOptions> {
  const supabase = await createClient();
  const [patients, markers, conversions] = await Promise.all([
    supabase.from("patient_profiles").select("id, first_name, last_name, clinic_ref").is("archived_at", null).order("last_name").order("first_name"),
    supabase.from("markers").select("id, name, code, unit, category").order("category").order("name"),
    supabase.from("marker_conversions").select("marker_id, from_unit").order("from_unit"),
  ]);
  if (patients.error || markers.error || conversions.error) throw new Error("Could not load the form.");
  return {
    patients: patients.data.map((p) => ({ id: p.id, name: fullName(p), clinicRef: p.clinic_ref })),
    markers: markers.data.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      unit: m.unit,
      otherUnits: conversions.data.filter((c) => c.marker_id === m.id).map((c) => c.from_unit),
    })),
  };
}

export type ImportForEntry = { id: string; patientId: string | null; documentId: string; title: string };

export async function getImportForEntry(id: string): Promise<ImportForEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("result_imports")
    .select("id, patient_id, document_id, status, document:documents(title)")
    .eq("id", id)
    .in("status", ["needs_match", "matched"])
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, patientId: data.patient_id, documentId: data.document_id, title: data.document?.title ?? "File" };
}

export type ReportResult = {
  id: string;
  markerName: string;
  category: string;
  value: number | string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: ResultFlag | null;
  originalValue: number | null;
  originalUnit: string | null;
  doctorComment: string | null;
};

export type ReportDetail = {
  id: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
  labName: string | null;
  sampleDate: string | null;
  receivedAt: string;
  status: ReportStatus;
  releasedAt: string | null;
  reviewedAt: string | null;
  patientComment: string | null;
  fileTitle: string | null;
  fileUrl: string | null;
  results: ReportResult[];
};

export async function getReport(id: string): Promise<ReportDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_reports")
    .select(
      "id, patient_id, document_id, external_lab_name, sample_date, received_at, status, released_at, reviewed_at, patient_comment, patient:patient_profiles(first_name, last_name, clinic_ref), results(id, value_numeric, value_text, unit, ref_low, ref_high, flag, original_value, original_unit, doctor_comment, marker:markers(name, category))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the report.");
  if (!data) return null;

  // A short-lived link, made through the person's own session: the file policy decides who gets one.
  let fileUrl: string | null = null;
  let fileTitle: string | null = null;
  if (data.document_id) {
    const file = await supabase.from("documents").select("title, storage_path").eq("id", data.document_id).maybeSingle();
    if (file.data) {
      fileTitle = file.data.title;
      const signed = await supabase.storage.from("documents").createSignedUrl(file.data.storage_path, 300);
      fileUrl = signed.data?.signedUrl ?? null;
    }
  }

  return {
    id: data.id,
    patientId: data.patient_id,
    patientName: fullName(data.patient),
    clinicRef: data.patient?.clinic_ref ?? "",
    labName: data.external_lab_name,
    sampleDate: data.sample_date,
    receivedAt: data.received_at,
    status: data.status,
    releasedAt: data.released_at,
    reviewedAt: data.reviewed_at,
    patientComment: data.patient_comment,
    fileTitle,
    fileUrl,
    results: data.results
      .map((r) => ({
        id: r.id,
        markerName: r.marker?.name ?? "Marker",
        category: r.marker?.category ?? "",
        value: r.value_numeric ?? r.value_text ?? "",
        unit: r.unit,
        refLow: toNumber(r.ref_low),
        refHigh: toNumber(r.ref_high),
        flag: r.flag,
        originalValue: toNumber(r.original_value),
        originalUnit: r.original_unit,
        doctorComment: r.doctor_comment,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.markerName.localeCompare(b.markerName)),
  };
}

// The patient's side ------------------------------------------------------------------------------------

export type TrendPoint = { date: string; value: number; flag: ResultFlag | null };

export type MarkerTrend = {
  markerId: string;
  name: string;
  category: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  points: TrendPoint[];
  /** The doctor's comments on this marker, newest first. */
  comments: { date: string; text: string }[];
};

type MyResultRow = {
  marker_id: string;
  value_numeric: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: ResultFlag | null;
  doctor_comment: string | null;
  marker: { name: string; category: string } | null;
  report: { sample_date: string | null; released_at: string | null } | null;
};

/**
 * Every released result for the signed-in patient, grouped by marker and ordered by sample date.
 * Released only is also said in the query, because a doctor who is also a patient can read more.
 */
export async function getMyResults(): Promise<{ patientName: string; markers: MarkerTrend[] } | null> {
  const supabase = await createClient();
  const record = await supabase.rpc("get_my_patient_record");
  if (record.error) throw new Error("Could not load your record.");
  const patient = record.data[0];
  if (!patient) return null;

  const { data, error } = await supabase
    .from("results")
    .select(
      "marker_id, value_numeric, unit, ref_low, ref_high, flag, doctor_comment, marker:markers(name, category), report:lab_reports!inner(sample_date, released_at)",
    )
    .eq("patient_id", patient.id)
    .not("report.released_at", "is", null);
  if (error) throw new Error("Could not load your results.");

  const rows = data as unknown as MyResultRow[];
  const byMarker = new Map<string, MarkerTrend>();
  for (const row of rows.sort((a, b) => (a.report?.sample_date ?? "").localeCompare(b.report?.sample_date ?? ""))) {
    const value = toNumber(row.value_numeric);
    const date = row.report?.sample_date;
    if (value === null || !date) continue;
    let trend = byMarker.get(row.marker_id);
    if (!trend) {
      trend = {
        markerId: row.marker_id,
        name: row.marker?.name ?? "Marker",
        category: row.marker?.category ?? "",
        unit: row.unit,
        refLow: toNumber(row.ref_low),
        refHigh: toNumber(row.ref_high),
        points: [],
        comments: [],
      };
      byMarker.set(row.marker_id, trend);
    }
    trend.points.push({ date, value, flag: row.flag });
    // The range of the latest result is the one to show.
    trend.refLow = toNumber(row.ref_low);
    trend.refHigh = toNumber(row.ref_high);
    if (row.doctor_comment) trend.comments.unshift({ date, text: row.doctor_comment });
  }

  const markers = [...byMarker.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
  return { patientName: `${patient.first_name} ${patient.last_name}`, markers };
}
