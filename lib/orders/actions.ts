"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getPortalPatientId } from "@/lib/data/education";
import { getSiteUrl, isStripeConfigured } from "@/lib/env";
import { ORDER_ROUTES } from "@/lib/orders/constants";
import { announceOrderMade } from "@/lib/orders/notify";
import { createOrderCheckout } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export type OrderFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const TOO_MANY = "Too many attempts at once. Please wait a while and try again.";

/** The database's messages are written for people; anything else becomes a plain failure. */
function friendly(message: string | undefined, fallback = GENERIC_FAILURE): string {
  const known = [
    "You cannot order bloods for this patient.",
    "Record the patient's sex at birth before ordering bloods.",
    "That panel is not available for this patient.",
    "That panel is not available.",
    "Choose how the sample will be taken.",
    "That appointment does not belong to this patient.",
    "Use 2,000 characters or fewer for the notes.",
    "Only an order that has not been paid for can be cancelled.",
    "The sample can be recorded once the order is paid.",
    "You cannot change this order.",
  ];
  return known.find((k) => message?.includes(k)) ?? fallback;
}

function field(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v !== "" ? v : undefined;
}

async function requireOrderer() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((r) => r === "doctor" || r === "pa")) redirect("/clinic");
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.includes("admin")) redirect("/clinic");
  return user;
}

// The clinic -------------------------------------------------------------------------------------

/** A doctor or PA orders a panel. The database sets the price, the due date and checks the sex rule. */
export async function createOrder(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireOrderer();
  const parsed = z
    .object({
      patientId: z.uuid(),
      panelId: z.uuid({ message: "Choose a panel." }),
      route: z.enum(ORDER_ROUTES as [string, ...string[]], { message: "Choose how the sample will be taken." }),
      appointmentId: z.uuid().optional(),
      sampleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.").optional(),
      notes: z.string().trim().max(2000, "Use 2,000 characters or fewer for the notes.").optional(),
    })
    .safeParse({
      patientId: field(formData, "patientId"),
      panelId: field(formData, "panelId"),
      route: field(formData, "route"),
      appointmentId: field(formData, "appointmentId"),
      sampleDate: field(formData, "sampleDate"),
      notes: field(formData, "notes"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };

  const d = parsed.data;
  const supabase = await createClient();
  // Optional values go to the database as null; the generated types cannot say so.
  const { data: orderId, error } = await supabase.rpc("create_lab_order", {
    _patient: d.patientId,
    _panel: d.panelId,
    _route: d.route as "tdl_site" | "tdl_kit",
    _appointment: (d.appointmentId ?? null) as string,
    _sample_date: (d.sampleDate ?? null) as string,
    _clinical_notes: d.notes ?? "",
  });
  if (error || !orderId) return { error: friendly(error?.message) };

  const delivery = await announceOrderMade(orderId);
  revalidatePath("/clinic/orders");
  revalidatePath(`/clinic/patients/${d.patientId}`);
  const told = delivery && (delivery.email === "sent" || delivery.whatsapp === "sent");
  redirect(`/clinic/orders?ordered=${told ? "told" : "untold"}`);
}

async function orderAction(formData: FormData, rpc: "cancel_lab_order" | "record_sample_taken", saved: string): Promise<OrderFormState> {
  const user = await requireOrderer();
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { _order: id.data });
  if (error) return { error: friendly(error.message, "You cannot change this order.") };
  revalidatePath("/clinic/orders");
  revalidatePath("/portal/bloods", "layout");
  return { saved, sentAt: Date.now() };
}

export async function cancelOrder(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  return orderAction(formData, "cancel_lab_order", "Order cancelled.");
}

export async function recordSampleTaken(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  return orderAction(formData, "record_sample_taken", "Sample recorded.");
}

// Admin: the catalogue ---------------------------------------------------------------------------

const money = z
  .string()
  .trim()
  .regex(/^\d{1,5}(\.\d{1,2})?$/, "Enter a price in pounds, for example 295 or 45.50.")
  .transform((v) => Math.round(Number(v) * 100));

const panelFields = {
  name: z.string().trim().min(1, "Give the panel a name.").max(120, "Use 120 characters or fewer for the name."),
  price: money,
  fasting: z.enum(["on"]).optional(),
  active: z.enum(["on"]).optional(),
  preparation: z.string().trim().max(1000, "Use 1,000 characters or fewer for the preparation.").optional(),
  tubes: z.string().trim().max(200, "Use 200 characters or fewer for the tubes.").optional(),
  sexRestriction: z.enum(["", "F", "M"]).optional(),
};

function panelValues(formData: FormData) {
  return {
    name: field(formData, "name"),
    price: field(formData, "price"),
    fasting: field(formData, "fasting"),
    active: field(formData, "active"),
    preparation: field(formData, "preparation"),
    tubes: field(formData, "tubes"),
    sexRestriction: field(formData, "sexRestriction") ?? "",
  };
}

export async function savePanel(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireAdmin();
  const parsed = z.object({ panelId: z.uuid(), ...panelFields }).safeParse({ panelId: field(formData, "panelId"), ...panelValues(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_panels")
    .update({
      name: d.name,
      price_pence: d.price,
      fasting_required: d.fasting === "on",
      active: d.active === "on",
      preparation: d.preparation ?? null,
      tubes: d.tubes ?? null,
      sex_restriction: d.sexRestriction || null,
    })
    .eq("id", d.panelId);
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/panels");
  return { saved: "Saved.", sentAt: Date.now() };
}

export async function addPanel(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      labPartnerId: z.uuid({ message: "Choose the lab." }),
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,20}$/, "Use up to 20 letters, numbers or hyphens for the code."),
      ...panelFields,
    })
    .safeParse({ labPartnerId: field(formData, "labPartnerId"), code: field(formData, "code") ?? "", ...panelValues(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("lab_panels").insert({
    lab_partner_id: d.labPartnerId,
    code: d.code,
    name: d.name,
    price_pence: d.price,
    fasting_required: d.fasting === "on",
    active: d.active === "on",
    preparation: d.preparation ?? null,
    tubes: d.tubes ?? null,
    sex_restriction: d.sexRestriction || null,
  });
  if (error) return { error: error.code === "23505" ? "A panel with that code already exists." : GENERIC_FAILURE };
  revalidatePath("/clinic/panels");
  return { saved: "Panel added.", sentAt: Date.now() };
}

export async function saveRouteFee(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireAdmin();
  const parsed = z
    .object({ route: z.enum(ORDER_ROUTES as [string, ...string[]]), fee: money })
    .safeParse({ route: field(formData, "route"), fee: field(formData, "fee") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };
  const supabase = await createClient();
  const { error } = await supabase.from("lab_route_fees").update({ fee_pence: parsed.data.fee }).eq("route", parsed.data.route as "tdl_site" | "tdl_kit");
  if (error) return { error: GENERIC_FAILURE };
  revalidatePath("/clinic/panels");
  return { saved: "Saved. New orders use this fee; existing orders keep theirs.", sentAt: Date.now() };
}

// The patient ------------------------------------------------------------------------------------

/** Pay for an order. Only for the patient chosen in the portal, by someone who can act for them. */
export async function payOrder(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.hasPatientView) redirect("/portal");
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) redirect("/portal/bloods");
  if (!(await allowAuthAttempt("bloods-order", user.email))) redirect(`/portal/bloods/${id.data}?payment=busy`);
  const patient = await getPortalPatientId();
  const supabase = await createClient();
  const { data } = await supabase.from("lab_orders").select("id, patient_id, status, price_pence").eq("id", id.data).maybeSingle();
  if (!patient?.canAct || !data || data.patient_id !== patient.id) redirect("/portal/bloods");
  if (data.status !== "sent_to_patient" || !isStripeConfigured()) redirect(`/portal/bloods/${id.data}`);
  let url: string | null = null;
  try {
    const back = `${getSiteUrl()}/portal/bloods/${id.data}`;
    const session = await createOrderCheckout({ orderId: id.data, amountPence: data.price_pence, successUrl: `${back}?paid=1`, cancelUrl: `${back}?cancelled=1` });
    url = session.url;
  } catch {
    console.error("Stripe payment page not opened.");
  }
  redirect(url ?? `/portal/bloods/${id.data}?payment=failed`);
}
