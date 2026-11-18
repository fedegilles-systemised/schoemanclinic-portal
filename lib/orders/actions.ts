"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { getPortalPatientId } from "@/lib/data/education";
import { getSiteUrl, isStripeConfigured } from "@/lib/env";
import { ORDER_ROUTES } from "@/lib/orders/constants";
import { announceOrderMade, announceOrderRefunded } from "@/lib/orders/notify";
import { parsePanelImport } from "@/lib/orders/panel-import";
import { createOrderCheckout, refundOrderPayment } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
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
    "Only a paid order whose results have not arrived can be refunded.",
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

/**
 * An admin refunds the whole payment of a paid order. Stripe is asked first, with a fixed key so a
 * second press cannot refund twice, and only then is the refund recorded and the order cancelled. If
 * Stripe has refunded but the record fails, pressing the button again is safe: Stripe returns the same
 * refund and the record is made.
 */
export async function refundOrder(_state: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) return { error: GENERIC_FAILURE };
  if (!isStripeConfigured()) return { error: "Payments are not switched on, so there is nothing to refund here." };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const [order, staff] = await Promise.all([
    supabase.from("lab_orders").select("id, status, price_pence, stripe_payment_intent_id, refunded_at").eq("id", id.data).maybeSingle(),
    supabase.from("staff_profiles").select("id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (order.error || staff.error || !order.data || !staff.data) return { error: GENERIC_FAILURE };
  const o = order.data;
  if (o.refunded_at) return { error: "This order has already been refunded." };
  if ((o.status !== "paid" && o.status !== "sample_taken") || !o.stripe_payment_intent_id) {
    return { error: "Only a paid order whose results have not arrived can be refunded." };
  }

  let refund;
  try {
    refund = await refundOrderPayment({ orderId: o.id, paymentIntent: o.stripe_payment_intent_id });
  } catch {
    console.error("Stripe refund not made.");
    return { error: "Stripe could not make the refund. Nothing has changed. Please try again, or refund it in Stripe." };
  }
  if (refund.status !== "succeeded" && refund.status !== "pending") {
    return { error: "Stripe did not complete the refund. Nothing has changed. Check it in Stripe." };
  }
  if (refund.amountPence !== o.price_pence) {
    return { error: "Stripe refunded a different amount from the price paid. Check this order in Stripe." };
  }

  const admin = createAdminClient();
  const recorded = await admin.rpc("record_lab_order_refund", { _order: o.id, _refund: refund.id, _amount: refund.amountPence, _by: staff.data.id });
  if (recorded.error) {
    console.error("Refund made in Stripe but not recorded.");
    return { error: "Stripe has refunded this order, but Clinic Hub could not record it. Press Refund again: it will not refund twice." };
  }
  const delivery = recorded.data ? await announceOrderRefunded(o.id) : null;
  revalidatePath("/clinic/orders");
  revalidatePath("/portal/bloods", "layout");
  // The refunded order leaves "In progress", taking this button with it, so the result is shown on the list.
  const told = delivery && (delivery.email === "sent" || delivery.whatsapp === "sent");
  redirect(`/clinic/orders?refunded=${!recorded.data ? "already" : told ? "told" : "untold"}`);
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

/** A price worth a second look: nothing, very high (a decimal comma can be misread), or far from the current one. */
function priceWarning(pricePence: number, currentPence: number | null): string | null {
  if (pricePence === 0) return "The price is £0.";
  if (pricePence > 200_000) return "The price is over £2,000. Check it was not typed with a comma for the decimal point.";
  if (currentPence !== null && currentPence > 0 && Math.abs(pricePence - currentPence) / currentPence > 0.5) return "The price changes by more than half.";
  return null;
}

export type ImportPreviewRow = {
  code: string;
  name: string;
  pricePence: number;
  previousPricePence: number | null;
  fasting: boolean;
  sexRestriction: "F" | "M" | null;
  tubes: string | null;
  orderable: boolean;
  change: "new" | "update";
  /** Something worth a second look before importing, such as a price of nothing or a big change. */
  warning: string | null;
  /** The warning is about the price: the admin must tick that they checked before importing (S-258). */
  needsAck: boolean;
  labName: string | null;
};
export type PanelImportState = OrderFormState & { preview?: { rows: ImportPreviewRow[]; errors: string[] } };

/**
 * An admin loads a panel list from a spreadsheet. "preview" checks it and shows what would change;
 * "import" writes it. The text is parsed again on the server each time, so a preview cannot be
 * edited into something else. A code already in the catalogue is updated, a new one is added to the
 * chosen lab, and nothing is deleted.
 */
export async function importPanels(_state: PanelImportState, formData: FormData): Promise<PanelImportState> {
  const user = await requireAdmin();
  const text = typeof formData.get("data") === "string" ? (formData.get("data") as string) : "";
  const mode = formData.get("mode") === "import" ? "import" : "preview";
  const parsed = parsePanelImport(text);
  if (parsed.errors.length > 0) return { error: "Fix the rows below, then check again.", preview: { rows: [], errors: parsed.errors } };
  if (!(await allowAuthAttempt("bloods-order", user.email))) return { error: TOO_MANY };

  const supabase = await createClient();
  const [existing, labs] = await Promise.all([
    supabase.from("lab_panels").select("id, code, price_pence, active, archived_at"),
    supabase.from("lab_partners").select("id, name"),
  ]);
  if (existing.error || labs.error) return { error: GENERIC_FAILURE };
  const byCode = new Map(existing.data.map((p) => [p.code, p]));
  const chosenLab = z.uuid().safeParse(field(formData, "labPartnerId"));
  const defaultOrderable = field(formData, "orderable") === "on";

  const errors: string[] = [];
  const rows: (ImportPreviewRow & { labId: string | null; panelId: string | null; active: boolean | null })[] = [];
  for (const r of parsed.rows) {
    const current = byCode.get(r.code);
    if (current?.archived_at) {
      errors.push(`Row ${r.line}: the code ${r.code} belongs to an archived panel and cannot be imported.`);
      continue;
    }
    let labId: string | null = null;
    if (!current) {
      if (r.lab) {
        const named = labs.data.filter((l) => l.name.toLowerCase() === r.lab!.toLowerCase());
        if (named.length !== 1) {
          errors.push(`Row ${r.line}: the lab "${r.lab}" is not one of the clinic's labs. Use its full name.`);
          continue;
        }
        labId = named[0]!.id;
      } else if (chosenLab.success && labs.data.some((l) => l.id === chosenLab.data)) {
        labId = chosenLab.data;
      } else {
        errors.push(`Row ${r.line}: choose the lab for the new panel ${r.code}.`);
        continue;
      }
    }
    rows.push({
      code: r.code,
      name: r.name,
      pricePence: r.pricePence,
      previousPricePence: current ? current.price_pence : null,
      fasting: r.fasting,
      sexRestriction: r.sexRestriction,
      tubes: r.tubes,
      orderable: r.active ?? (current ? current.active : defaultOrderable),
      change: current ? "update" : "new",
      warning:
        [priceWarning(r.pricePence, current?.price_pence ?? null), current && r.lab ? "The lab named on the sheet is ignored: this panel keeps its own lab." : null].filter(Boolean).join(" ") || null,
      needsAck: priceWarning(r.pricePence, current?.price_pence ?? null) !== null,
      labName: labId ? (labs.data.find((l) => l.id === labId)?.name ?? null) : null,
      labId,
      panelId: current?.id ?? null,
      active: r.active,
    });
  }
  const preview = {
    rows: rows.map((r): ImportPreviewRow => ({
      code: r.code,
      name: r.name,
      pricePence: r.pricePence,
      previousPricePence: r.previousPricePence,
      fasting: r.fasting,
      sexRestriction: r.sexRestriction,
      tubes: r.tubes,
      orderable: r.orderable,
      change: r.change,
      warning: r.warning,
      needsAck: r.needsAck,
      labName: r.labName,
    })),
    errors,
  };
  if (errors.length > 0) return { error: "Fix the rows below, then check again.", preview };
  if (mode === "preview") return { preview, sentAt: Date.now() };
  if (rows.some((r) => r.needsAck) && field(formData, "acknowledged") !== "on") {
    return { error: "Some prices need a second look. Tick the box to confirm you have checked them, then import.", preview };
  }

  const fresh = rows.filter((r) => r.change === "new");
  const changed = rows.filter((r) => r.change === "update");
  const prepFor = new Map(parsed.rows.map((r) => [r.code, r.preparation]));
  if (fresh.length > 0) {
    const { error } = await supabase.from("lab_panels").insert(
      fresh.map((r) => ({
        lab_partner_id: r.labId as string,
        code: r.code,
        name: r.name,
        price_pence: r.pricePence,
        fasting_required: r.fasting,
        tubes: r.tubes,
        preparation: prepFor.get(r.code) ?? null,
        sex_restriction: r.sexRestriction,
        active: r.orderable,
      })),
    );
    if (error) return { error: "The new panels could not be added. Nothing was added; try again.", preview };
  }
  const failedCodes: string[] = [];
  for (const r of changed) {
    const { error } = await supabase
      .from("lab_panels")
      .update({
        name: r.name,
        price_pence: r.pricePence,
        // A column the sheet does not have leaves the panel's value alone; a blank cell clears it.
        ...(parsed.columns.fasting ? { fasting_required: r.fasting } : {}),
        ...(parsed.columns.tubes ? { tubes: r.tubes } : {}),
        ...(parsed.columns.preparation ? { preparation: prepFor.get(r.code) ?? null } : {}),
        ...(parsed.columns.sex ? { sex_restriction: r.sexRestriction } : {}),
        ...(r.active === null ? {} : { active: r.active }),
      })
      .eq("id", r.panelId as string);
    if (error) failedCodes.push(r.code);
  }
  revalidatePath("/clinic/panels");
  if (failedCodes.length > 0) {
    return { error: `${fresh.length} added, but these updates failed: ${failedCodes.join(", ")}. Import again: it is safe to repeat.`, sentAt: Date.now() };
  }
  return { saved: `Done: ${fresh.length} added, ${changed.length} updated.`, sentAt: Date.now() };
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
