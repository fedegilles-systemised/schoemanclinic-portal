import "server-only";

import type { Database } from "@/lib/database.types";
import { sendEmail as sendResendEmail } from "@/lib/email/send";
import type { EmailContent } from "@/lib/email/layout";
import { isGhlConfigured } from "@/lib/env";
import { sendEmail as sendGhlEmail, sendWhatsApp, upsertContact } from "@/lib/ghl/client";
import { createAdminClient } from "@/lib/supabase/admin";

type Topic = Database["public"]["Enums"]["notification_topic"];

export type PatientMessage = {
  topic: Topic;
  email: EmailContent;
  /** Plain text for WhatsApp. Like every message, never a value, a diagnosis or a medicine. */
  whatsapp: string;
};

export type Delivery = { email: "sent" | "off" | "no-address" | "failed"; whatsapp: "sent" | "off" | "no-phone" | "not-connected" | "failed" };

/**
 * Tells a patient something by email, and by WhatsApp if they turned it on. With GoHighLevel
 * connected both go through it, so the clinic's team see them in the contact's conversation;
 * without it, email goes through Resend and WhatsApp is not sent. A missing email choice counts as
 * on; a missing WhatsApp choice counts as off. Never throws: a failed message never undoes the
 * thing it reports, and each attempt is written to integration_sync_log.
 */
export async function notifyPatient(patientId: string, message: PatientMessage): Promise<Delivery> {
  const delivery: Delivery = { email: "failed", whatsapp: "failed" };
  try {
    const admin = createAdminClient();
    const patient = await admin
      .from("patient_profiles")
      .select("id, user_id, first_name, last_name, contact_email, contact_phone, ghl_contact_id")
      .eq("id", patientId)
      .maybeSingle();
    if (patient.error || !patient.data) return delivery;
    const p = patient.data;

    const account = p.user_id
      ? await admin.from("profiles").select("email, phone, status").eq("id", p.user_id).maybeSingle()
      : null;
    if (account?.data?.status === "suspended") return { email: "off", whatsapp: "off" };
    const email = account?.data?.email ?? p.contact_email;
    const phone = p.contact_phone ?? account?.data?.phone ?? null;

    const choices = p.user_id
      ? await admin.from("notification_preferences").select("channel, enabled").eq("user_id", p.user_id).eq("topic", message.topic)
      : { data: [] as { channel: string; enabled: boolean }[], error: null };
    if (choices.error) return delivery;
    const choice = (channel: string) => choices.data?.find((row) => row.channel === channel)?.enabled;
    const wantsEmail = choice("email") ?? true;
    const wantsWhatsApp = choice("whatsapp") ?? false;

    let ghl = isGhlConfigured();
    // The GoHighLevel contact is looked up afresh on every send with today's details, so a changed
    // email or phone is used at once. Only the details the chosen channels need are sent. If that
    // contact already belongs to another patient (a family sharing an email or phone), GoHighLevel is
    // not used for this patient: email goes through Resend and WhatsApp is not sent.
    let contactId: string | null = null;
    const contact = async () => {
      if (contactId) return contactId;
      const found = await upsertContact({
        firstName: p.first_name,
        lastName: p.last_name,
        email: wantsEmail ? email : null,
        phone: wantsWhatsApp ? phone : null,
      });
      if (found !== p.ghl_contact_id) {
        const linked = await admin.rpc("set_patient_ghl_contact", { _patient: p.id, _contact: found });
        if (linked.error) throw new SharedContactError();
      }
      contactId = found;
      return found;
    };

    // Email.
    if (!wantsEmail) delivery.email = "off";
    else if (!email) delivery.email = "no-address";
    else {
      try {
        if (ghl) {
          try {
            await sendGhlEmail(await contact(), message.email.subject, message.email.html);
          } catch (error) {
            if (!(error instanceof SharedContactError)) throw error;
            ghl = false;
          }
        }
        if (!ghl) {
          const sent = await sendResendEmail({ to: email, ...message.email });
          if (!sent.ok) throw new Error("Resend refused the email");
        }
        delivery.email = "sent";
      } catch {
        delivery.email = "failed";
      }
      await log(admin, p.id, ghl ? "ghl" : null, delivery.email);
    }

    // WhatsApp.
    if (!wantsWhatsApp) delivery.whatsapp = "off";
    else if (!ghl) delivery.whatsapp = "not-connected";
    else if (!phone) delivery.whatsapp = "no-phone";
    else {
      try {
        await sendWhatsApp(await contact(), message.whatsapp);
        delivery.whatsapp = "sent";
      } catch {
        delivery.whatsapp = "failed";
      }
      await log(admin, p.id, "ghl", delivery.whatsapp);
    }
    return delivery;
  } catch {
    console.error("Patient message not sent: something went wrong before it could be sent.");
    return delivery;
  }
}

/** GoHighLevel matched this patient to a contact that belongs to another patient. */
class SharedContactError extends Error {}

async function log(admin: ReturnType<typeof createAdminClient>, patientId: string, system: "ghl" | null, outcome: string) {
  if (system !== "ghl") return;
  await admin.from("integration_sync_log").insert({
    system: "ghl",
    direction: "out",
    entity: "patient_profiles",
    entity_id: patientId,
    status: outcome === "sent" ? "ok" : "failed",
    error: outcome === "sent" ? null : "message not sent",
    finished_at: new Date().toISOString(),
  });
}
