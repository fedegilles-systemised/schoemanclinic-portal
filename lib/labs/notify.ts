import "server-only";

import { sendEmail } from "@/lib/email/send";
import { labFileAlertEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { LAB_ALERT_TO_DEFAULT } from "@/lib/labs/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A lab file has reached the import queue: the admins and PAs are told in Clinic Hub and the clinic
 * inbox gets an email. Only a link, never a name, an email address or a test. Never throws, so a failed
 * message cannot undo the filing it reports.
 */
export async function announceLabFile({ matched }: { matched: boolean }): Promise<void> {
  try {
    const admin = createAdminClient();
    const roles = await admin.from("user_roles").select("user_id, profile:profiles!user_roles_user_id_fkey!inner(status)").in("role", ["admin", "pa"]);
    const recipients = new Set<string>();
    for (const row of roles.data ?? []) if (row.profile?.status !== "suspended") recipients.add(row.user_id);
    if (recipients.size > 0) {
      await admin.from("notifications").insert(
        [...recipients].map((userId) => ({
          user_id: userId,
          topic: "results" as const,
          title: "A lab report has arrived",
          body: matched ? "It is filed under a patient and waiting for its values to be entered." : "It could not be matched to a patient, so it needs matching.",
          link: "/clinic/results",
        })),
      );
    }
    try {
      const siteUrl = getSiteUrl();
      await sendEmail({
        to: process.env.LAB_ALERT_TO || LAB_ALERT_TO_DEFAULT,
        ...labFileAlertEmail({ siteUrl, queueUrl: `${siteUrl}/clinic/results` }),
      });
    } catch {
      console.error("Lab file alert not emailed.");
    }
  } catch {
    console.error("Lab file alert not sent.");
  }
}
