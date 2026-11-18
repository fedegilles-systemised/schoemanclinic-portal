import "server-only";

import { bloodsOrderedEmail, bloodsPaidEmail, bloodsRefundedEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/format";
import { notifyPatient, type Delivery } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A patient is told their blood test is waiting for payment. Never which panel, never a value. Never
 * throws: a message that fails does not undo the order, and the team is told the result.
 */
export async function announceOrderMade(orderId: string): Promise<Delivery | null> {
  try {
    const admin = createAdminClient();
    const order = await admin
      .from("lab_orders")
      .select("id, patient_id, due_by, patient:patient_profiles!inner(first_name)")
      .eq("id", orderId)
      .maybeSingle();
    if (order.error || !order.data) return null;
    const siteUrl = getSiteUrl();
    const link = `/portal/bloods/${orderId}`;
    return await notifyPatient(order.data.patient_id, {
      topic: "payments",
      notice: { title: "Your blood test is ready to book", body: "Open your order to pay and see how to prepare.", link },
      email: bloodsOrderedEmail({
        siteUrl,
        firstName: order.data.patient.first_name,
        portalUrl: `${siteUrl}${link}`,
        dueBy: order.data.due_by ? formatDate(order.data.due_by) : null,
      }),
      whatsapp: `Hello ${order.data.patient.first_name}, your clinician has ordered a blood test for you. Please sign in to your portal to pay and see how to prepare.`,
    });
  } catch {
    console.error("Could not tell the patient about the blood test order.");
    return null;
  }
}

/** The receipt. Never throws, so a failed message cannot undo a recorded payment. */
export async function announceOrderPaid(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const order = await admin
      .from("lab_orders")
      .select("id, patient_id, price_pence, patient:patient_profiles!inner(first_name)")
      .eq("id", orderId)
      .maybeSingle();
    if (order.error || !order.data) return;
    const siteUrl = getSiteUrl();
    const link = `/portal/bloods/${orderId}`;
    await notifyPatient(order.data.patient_id, {
      topic: "payments",
      notice: { title: "Payment received", body: "Your barcode and how to prepare are in your order.", link },
      email: bloodsPaidEmail({
        siteUrl,
        firstName: order.data.patient.first_name,
        portalUrl: `${siteUrl}${link}`,
        amount: formatMoney(order.data.price_pence),
      }),
      whatsapp: `Hello ${order.data.patient.first_name}, we have received your payment for your blood test. Your barcode and how to prepare are in your portal.`,
    });
  } catch {
    console.error("Could not send the blood test receipt.");
  }
}

/** The patient is told their blood test was refunded. Never throws: a failed message cannot undo a refund. */
export async function announceOrderRefunded(orderId: string): Promise<Delivery | null> {
  try {
    const admin = createAdminClient();
    const order = await admin
      .from("lab_orders")
      .select("id, patient_id, refund_pence, patient:patient_profiles!inner(first_name)")
      .eq("id", orderId)
      .maybeSingle();
    if (order.error || !order.data || order.data.refund_pence === null) return null;
    const siteUrl = getSiteUrl();
    const amount = formatMoney(order.data.refund_pence);
    return await notifyPatient(order.data.patient_id, {
      topic: "payments",
      notice: { title: "Your blood test has been refunded", body: `${amount} is on its way back to your card.`, link: `/portal/bloods/${orderId}` },
      email: bloodsRefundedEmail({ siteUrl, firstName: order.data.patient.first_name, amount }),
      whatsapp: `Hello ${order.data.patient.first_name}, we have refunded ${amount} for your blood test. Your bank decides when it shows on your statement, usually within 10 working days.`,
    });
  } catch {
    console.error("Could not tell the patient about the refund.");
    return null;
  }
}
