import "server-only";

import { addDays, daysBetween, londonDate } from "@/lib/format";
import { requestStage, type RequestStage, type RequestStatus } from "@/lib/prescriptions/constants";
import { createClient } from "@/lib/supabase/server";

export type CurrentMedicine = {
  id: string;
  name: string;
  dose: string | null;
  instructions: string | null;
  kind: "prescription" | "supplement";
  runOut: string;
  daysLeft: number;
};

export type CatalogueMedicine = { id: string; name: string; weightLoss: boolean; archived: boolean };

export type RequestItem = { id: string; name: string; supplyMonths: number; source: "current" | "list" | "typed" };

export type RequestSummary = {
  id: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
  requestedAt: string;
  paidAt: string | null;
  stage: RequestStage;
  status: RequestStatus;
  itemCount: number;
  firstItem: string;
};

export type RequestDetail = RequestSummary & {
  items: RequestItem[];
  feePence: number;
  note: string | null;
  hasFutureAppointment: boolean | null;
  wantsAppointment: boolean | null;
  stillLosingWeight: boolean | null;
  weightLostLastMonth: string | null;
  hasSideEffects: boolean | null;
  sideEffects: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  requestedBy: string;
  resolvedAt: string | null;
  cancelledAt: string | null;
};

const REQUEST_COLUMNS =
  "id, patient_id, requested_at, paid_at, cancelled_at, status, fee_pence, note, has_future_appointment, wants_appointment, still_losing_weight, weight_lost_last_month, has_side_effects, side_effects, decision_note, decided_by, requested_by, resolved_at, patient:patient_profiles!repeat_requests_patient_id_fkey(first_name, last_name, clinic_ref), legacy:medications!repeat_requests_medication_fkey(name), items:repeat_request_items(id, supply_months, other_name, medication:medications!repeat_request_items_medication_fkey(name, dose), medicine:prescribable_medicines(name))";

type ItemRow = {
  id: string;
  supply_months: number;
  other_name: string | null;
  medication: { name: string; dose: string | null } | null;
  medicine: { name: string } | null;
};

function itemOf(row: ItemRow): RequestItem {
  if (row.other_name) return { id: row.id, name: row.other_name, supplyMonths: row.supply_months, source: "typed" };
  if (row.medication) {
    const name = row.medication.dose ? `${row.medication.name} (${row.medication.dose})` : row.medication.name;
    return { id: row.id, name, supplyMonths: row.supply_months, source: "current" };
  }
  return { id: row.id, name: row.medicine?.name ?? "A medicine from the clinic's list", supplyMonths: row.supply_months, source: "list" };
}

/** The patient's active medicines, each with the day its supply runs out. */
export async function getCurrentMedicines(patientId: string): Promise<CurrentMedicine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("id, name, dose, instructions, kind, start_date, supply_days")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load the medicines.");
  const today = londonDate();
  return data.map((m) => {
    const runOut = addDays(m.start_date, m.supply_days);
    return { id: m.id, name: m.name, dose: m.dose, instructions: m.instructions, kind: m.kind, runOut, daysLeft: daysBetween(today, runOut) };
  });
}

/** The clinic's list. Patients see current entries only (row-level security); admins and doctors see all. */
export async function getCatalogue({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<CatalogueMedicine[]> {
  const supabase = await createClient();
  let query = supabase.from("prescribable_medicines").select("id, name, weight_loss, archived_at").order("name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the medicine list.");
  return data.map((m) => ({ id: m.id, name: m.name, weightLoss: m.weight_loss, archived: m.archived_at !== null }));
}

/** Is a visit booked from today on? Used to answer the appointment question for the patient. */
export async function hasUpcomingAppointment(patientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .in("status", ["booked", "confirmed"])
    .gte("starts_at", new Date().toISOString())
    .limit(1);
  if (error) return false;
  return data.length > 0;
}

type RequestRow = {
  id: string;
  patient_id: string;
  requested_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  status: RequestStatus;
  patient: { first_name: string; last_name: string; clinic_ref: string } | null;
  legacy: { name: string } | null;
  items: ItemRow[];
};

function summaryOf(r: RequestRow): RequestSummary {
  const items = r.items.map(itemOf);
  const first = items[0]?.name ?? r.legacy?.name ?? "Medicine";
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "",
    clinicRef: r.patient?.clinic_ref ?? "",
    requestedAt: r.requested_at,
    paidAt: r.paid_at,
    stage: requestStage({ status: r.status, paidAt: r.paid_at, cancelledAt: r.cancelled_at }),
    status: r.status,
    itemCount: Math.max(items.length, 1),
    firstItem: first,
  };
}

/**
 * Repeat requests the signed-in person may read: one patient's in the portal, or every patient they
 * can open in the clinic. Row-level security decides; the patient filter keeps a team member who is
 * also a patient to their own requests in the portal.
 */
export async function listRepeatRequests({ patientId }: { patientId?: string } = {}): Promise<RequestSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("repeat_requests").select(REQUEST_COLUMNS).order("requested_at", { ascending: false }).limit(300);
  if (patientId) query = query.eq("patient_id", patientId);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the repeat requests.");
  return (data as unknown as RequestRow[]).map(summaryOf);
}

/** One request with its medicines and answers. Null if not found or not theirs. */
export async function getRepeatRequest(id: string): Promise<RequestDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("repeat_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the request.");
  if (!data) return null;
  const r = data as unknown as RequestRow & {
    fee_pence: number;
    note: string | null;
    has_future_appointment: boolean | null;
    wants_appointment: boolean | null;
    still_losing_weight: boolean | null;
    weight_lost_last_month: string | null;
    has_side_effects: boolean | null;
    side_effects: string | null;
    decision_note: string | null;
    decided_by: string | null;
    requested_by: string;
    resolved_at: string | null;
  };
  const items = r.items.map(itemOf);
  return {
    ...summaryOf(r),
    items: items.length > 0 ? items : r.legacy ? [{ id: `${r.id}-legacy`, name: r.legacy.name, supplyMonths: 1, source: "current" }] : [],
    feePence: r.fee_pence,
    note: r.note,
    hasFutureAppointment: r.has_future_appointment,
    wantsAppointment: r.wants_appointment,
    stillLosingWeight: r.still_losing_weight,
    weightLostLastMonth: r.weight_lost_last_month,
    hasSideEffects: r.has_side_effects,
    sideEffects: r.side_effects,
    decisionNote: r.decision_note,
    decidedBy: r.decided_by,
    requestedBy: r.requested_by,
    resolvedAt: r.resolved_at,
    cancelledAt: r.cancelled_at,
  };
}
