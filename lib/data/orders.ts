import "server-only";

import type { OrderRoute, OrderStatus } from "@/lib/orders/constants";
import { createClient } from "@/lib/supabase/server";

export type Panel = {
  id: string;
  code: string;
  name: string;
  pricePence: number;
  fasting: boolean;
  preparation: string | null;
  tubes: string | null;
  sexRestriction: "F" | "M" | null;
  active: boolean;
  labPartnerId: string;
  labName: string;
};

/** The catalogue. Staff see every panel; the ordering screen filters to active ones. */
export async function listPanels(): Promise<Panel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_panels")
    .select("id, code, name, price_pence, fasting_required, preparation, tubes, sex_restriction, active, lab_partner_id, lab:lab_partners!inner(name)")
    .is("archived_at", null)
    .order("code");
  if (error) throw new Error("Could not load the panels.");
  return data.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    pricePence: p.price_pence,
    fasting: p.fasting_required,
    preparation: p.preparation,
    tubes: p.tubes,
    sexRestriction: p.sex_restriction === "F" || p.sex_restriction === "M" ? p.sex_restriction : null,
    active: p.active,
    labPartnerId: p.lab_partner_id,
    labName: p.lab.name,
  }));
}

export async function listLabPartners(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_partners").select("id, name").order("name");
  if (error) throw new Error("Could not load the labs.");
  return data;
}

export type RouteFee = { route: OrderRoute; label: string; feePence: number };

export async function getRouteFees(): Promise<RouteFee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_route_fees").select("route, label, fee_pence").order("route");
  if (error) throw new Error("Could not load the fees.");
  return data.map((f) => ({ route: f.route, label: f.label, feePence: f.fee_pence }));
}

export type OrderSummary = {
  id: string;
  orderRef: string;
  status: OrderStatus;
  route: OrderRoute | null;
  pricePence: number;
  dueBy: string | null;
  refundedAt: string | null;
  createdAt: string;
  panelName: string;
  patientId: string;
  patientName: string;
  clinicRef: string;
};

// A patient cannot read the patient table directly, so the patient's own screens never embed it. Only
// staff lists add the name.
const SUMMARY_SELECT = "id, order_ref, status, route, price_pence, due_by, refunded_at, created_at, patient_id, panel:lab_panels!inner(name)";
const STAFF_SELECT = `${SUMMARY_SELECT}, patient:patient_profiles!inner(first_name, last_name, clinic_ref)`;

type SummaryRow = {
  id: string;
  order_ref: string;
  status: OrderStatus;
  route: OrderRoute | null;
  price_pence: number;
  due_by: string | null;
  refunded_at: string | null;
  created_at: string;
  patient_id: string;
  panel: { name: string };
  patient?: { first_name: string; last_name: string; clinic_ref: string };
};

function toSummary(r: SummaryRow): OrderSummary {
  return {
    id: r.id,
    orderRef: r.order_ref,
    status: r.status,
    route: r.route,
    pricePence: r.price_pence,
    dueBy: r.due_by,
    refundedAt: r.refunded_at,
    createdAt: r.created_at,
    panelName: r.panel.name,
    patientId: r.patient_id,
    patientName: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "",
    clinicRef: r.patient?.clinic_ref ?? "",
  };
}

/** One patient's orders, newest first. Row-level security decides whether the reader may see them. */
export async function listPatientOrders(patientId: string): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_orders").select(SUMMARY_SELECT).eq("patient_id", patientId).order("created_at", { ascending: false });
  if (error) throw new Error("Could not load the orders.");
  return data.map(toSummary);
}

/** Every order the signed-in staff member can see, newest first. */
export async function listClinicOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_orders").select(STAFF_SELECT).order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error("Could not load the orders.");
  return data.map(toSummary);
}

export type OrderDetail = OrderSummary & {
  feePence: number;
  fasting: boolean;
  sampleDate: string | null;
  barcode: string | null;
  paidAt: string | null;
  sampleTakenAt: string | null;
  panelCode: string;
  preparation: string | null;
  tubes: string | null;
};

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_orders")
    .select(
      "id, order_ref, status, route, price_pence, fee_pence, fasting, sample_date, barcode, paid_at, sample_taken_at, due_by, refunded_at, created_at, patient_id, panel:lab_panels!inner(name, code, preparation, tubes)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the order.");
  if (!data) return null;
  return {
    ...toSummary(data),
    feePence: data.fee_pence,
    fasting: data.fasting,
    sampleDate: data.sample_date,
    barcode: data.barcode,
    paidAt: data.paid_at,
    sampleTakenAt: data.sample_taken_at,
    panelCode: data.panel.code,
    preparation: data.panel.preparation,
    tubes: data.panel.tubes,
  };
}

/** A patient's upcoming appointments, for the due date of a new order. */
export async function listUpcomingAppointments(patientId: string): Promise<{ id: string; startsAt: string; type: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, type")
    .eq("patient_id", patientId)
    .in("status", ["booked", "confirmed"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(10);
  if (error) throw new Error("Could not load the appointments.");
  return data.map((a) => ({ id: a.id, startsAt: a.starts_at, type: a.type }));
}
