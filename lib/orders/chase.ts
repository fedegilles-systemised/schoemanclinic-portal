import "server-only";

import { bloodsReminderEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { notifyPatient } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unpaid blood test orders, kept tidy by the daily job (decided 18 November 2026): a reminder after 3 days and
 * another after 7, and an order nobody paid for in 30 days is closed. It is cancelled, never deleted, and the
 * patient is told. A reminder is counted once it was tried (a failed message is logged by notifyPatient and not repeated every day). Messages never say which panel. Never throws for one patient: a failure for one does not stop the rest.
 */
export async function chaseUnpaidOrders(): Promise<{ reminded: number; lapsed: number; failed: number }> {
  const admin = createAdminClient();
  const siteUrl = getSiteUrl();
  let reminded = 0;
  let lapsed = 0;
  let failed = 0;

  const toChase = await admin.rpc("unpaid_orders_to_chase");
  if (toChase.error) throw new Error("Could not list the orders to remind.");
  for (const row of toChase.data) {
    try {
      const order = await admin
        .from("lab_orders")
        .select("id, due_by, patient:patient_profiles!inner(first_name)")
        .eq("id", row.order_id)
        .maybeSingle();
      if (order.error || !order.data) {
        failed += 1;
        continue;
      }
      const link = `/portal/bloods/${row.order_id}`;
      const delivery = await notifyPatient(row.for_patient, {
        topic: "payments",
        notice: { title: "Your blood test is waiting for payment", body: "Open your order to pay and see how to prepare.", link },
        email: bloodsReminderEmail({ siteUrl, firstName: order.data.patient.first_name, portalUrl: `${siteUrl}${link}`, kind: "reminder", dueBy: order.data.due_by ? formatDate(order.data.due_by) : null }),
        whatsapp: `Hello ${order.data.patient.first_name}, your blood test is still waiting for payment. Please sign in to your portal to pay and see how to prepare.`,
      });
      // Counted whatever the outcome, so a message that cannot be delivered is not repeated every day with a new
      // notice each time; notifyPatient has already logged the failure.
      await admin.rpc("mark_lab_order_chased", { _order: row.order_id, _reminder: row.reminder });
      if (delivery.email === "sent" || delivery.whatsapp === "sent") reminded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  const closed = await admin.rpc("lapse_unpaid_lab_orders");
  if (closed.error) throw new Error("Could not close the unpaid orders.");
  for (const row of closed.data) {
    lapsed += 1;
    try {
      const patient = await admin.from("patient_profiles").select("first_name").eq("id", row.for_patient).maybeSingle();
      const link = `/portal/bloods/${row.order_id}`;
      await notifyPatient(row.for_patient, {
        topic: "payments",
        notice: { title: "Your blood test order has closed", body: "It was not paid for within 30 days. Contact the clinic if you still need it.", link },
        email: bloodsReminderEmail({ siteUrl, firstName: patient.data?.first_name, portalUrl: `${siteUrl}${link}`, kind: "lapsed" }),
        whatsapp: `Hello ${patient.data?.first_name ?? ""}, your blood test order has closed because it was not paid for within 30 days. Please contact the clinic if you still need the test.`,
      });
    } catch {
      console.error("Could not tell a patient their unpaid blood test order had closed.");
    }
  }
  return { reminded, lapsed, failed };
}
