import "server-only";

import { sendEmail } from "@/lib/email/send";
import { repeatPaidAlertEmail, repeatReceivedEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { londonDate } from "@/lib/format";
import { notifyPatient } from "@/lib/notify/patient";
import { PRESCRIPTIONS_ALERT_TO_DEFAULT } from "@/lib/prescriptions/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A repeat request has just been paid for (knowledge base question 13): admins, PAs and the
 * patient's doctors are told in Clinic Hub, the clinic inbox gets an email, and the patient gets a
 * receipt. Only names and links: never a medicine. Never throws, so a failed message cannot undo
 * the payment it reports.
 */
export async function announcePaidRequest(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const siteUrl = getSiteUrl();
    const request = await admin.from("repeat_requests").select("id, patient_id").eq("id", requestId).maybeSingle();
    if (request.error || !request.data) return;
    const patientId = request.data.patient_id;

    // Admins and PAs, and doctors currently on the patient's care team; active accounts only.
    const today = londonDate();
    const [roles, team] = await Promise.all([
      admin.from("user_roles").select("user_id, profile:profiles!user_roles_user_id_fkey!inner(status)").in("role", ["admin", "pa"]),
      admin
        .from("care_team")
        .select("since, until, staff:staff_profiles!inner(user_id, clinical_role)")
        .eq("patient_id", patientId)
        .lte("since", today),
    ]);
    const recipients = new Set<string>();
    for (const row of roles.data ?? []) if (row.profile?.status !== "suspended") recipients.add(row.user_id);
    for (const row of team.data ?? []) {
      if ((row.until === null || row.until > today) && row.staff?.clinical_role === "doctor" && row.staff.user_id) recipients.add(row.staff.user_id);
    }
    const link = `/clinic/prescriptions/${requestId}`;
    if (recipients.size > 0) {
      await admin.from("notifications").insert(
        [...recipients].map((userId) => ({
          user_id: userId,
          topic: "payments" as const,
          title: "Repeat prescription paid",
          body: "A patient has paid for a repeat prescription request.",
          link,
        })),
      );
    }

    try {
      await sendEmail({
        to: process.env.PRESCRIPTIONS_ALERT_TO || PRESCRIPTIONS_ALERT_TO_DEFAULT,
        ...repeatPaidAlertEmail({ siteUrl, requestUrl: `${siteUrl}${link}` }),
      });
    } catch {
      console.error("Repeat prescription alert not emailed.");
    }

    const patient = await admin.from("patient_profiles").select("first_name").eq("id", patientId).maybeSingle();
    const portalLink = `/portal/prescriptions/${requestId}`;
    await notifyPatient(patientId, {
      topic: "payments",
      notice: { title: "Repeat request received", body: "Your request and payment have reached the clinic.", link: portalLink },
      email: repeatReceivedEmail({ siteUrl, firstName: patient.data?.first_name, portalUrl: `${siteUrl}${portalLink}` }),
      whatsapp: `Hello ${patient.data?.first_name ?? ""}, we have received your repeat prescription request and payment. You can follow it in your portal.`,
    });
  } catch {
    console.error("Repeat prescription payment recorded, but the team or patient could not be told.");
  }
}
