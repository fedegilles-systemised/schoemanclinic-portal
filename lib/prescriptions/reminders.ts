import "server-only";

import { runOutReminderEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { addDays, londonDate } from "@/lib/format";
import { notifyPatient } from "@/lib/notify/patient";
import { RUN_OUT_WARNING_DAYS } from "@/lib/prescriptions/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily: tells each patient once, three weeks ahead, that a prescription will run out (agreed on the
 * call of 6 November 2026), unless a repeat for it is already on its way. One message per patient,
 * naming no medicine. Each medicine is remembered by its run-out date, so a renewed supply is
 * reminded about again next time.
 */
export async function sendRunOutReminders(): Promise<{ patients: number; medicines: number }> {
  const admin = createAdminClient();
  const today = londonDate();
  const horizon = addDays(today, RUN_OUT_WARNING_DAYS);

  // Active prescriptions of patients still with the clinic, read a page at a time.
  type Med = { id: string; patient_id: string; start_date: string; supply_days: number; run_out_reminded_for: string | null };
  const all: Med[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const page = await admin
      .from("medications")
      .select("id, patient_id, start_date, supply_days, run_out_reminded_for, patient:patient_profiles!medications_patient_id_fkey!inner(archived_at)")
      .eq("kind", "prescription")
      .eq("status", "active")
      .is("archived_at", null)
      .is("patient.archived_at", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (page.error) throw new Error("Could not read medicines.");
    all.push(...page.data);
    if (page.data.length < PAGE) break;
  }

  const due = all
    .map((m) => ({ ...m, runOut: addDays(m.start_date, m.supply_days) }))
    .filter((m) => m.runOut >= today && m.runOut <= horizon && m.run_out_reminded_for !== m.runOut);
  if (due.length === 0) return { patients: 0, medicines: 0 };

  // A medicine already in an open request, made in the last six weeks, needs no reminder.
  const open = await admin
    .from("repeat_request_items")
    .select("medication_id, request:repeat_requests!inner(status, cancelled_at, created_at)")
    .in(
      "medication_id",
      due.map((m) => m.id),
    )
    .in("request.status", ["requested", "approved", "sent_to_pharmacy"])
    .is("request.cancelled_at", null)
    .gte("request.created_at", new Date(Date.now() - 42 * 86_400_000).toISOString());
  if (open.error) throw new Error("Could not read open requests.");
  const requested = new Set(open.data.map((row) => row.medication_id));

  const byPatient = new Map<string, typeof due>();
  for (const m of due) {
    if (requested.has(m.id)) continue;
    byPatient.set(m.patient_id, [...(byPatient.get(m.patient_id) ?? []), m]);
  }

  const siteUrl = getSiteUrl();
  let medicines = 0;
  for (const [patientId, list] of byPatient) {
    const patient = await admin.from("patient_profiles").select("first_name").eq("id", patientId).maybeSingle();
    const link = "/portal/prescriptions";
    await notifyPatient(patientId, {
      topic: "messages",
      notice: { title: "Time to request a repeat", body: "A prescription runs out within three weeks.", link },
      email: runOutReminderEmail({ siteUrl, firstName: patient.data?.first_name, portalUrl: `${siteUrl}${link}` }),
      whatsapp: `Hello ${patient.data?.first_name ?? ""}, one of your prescriptions runs out within three weeks. Please request a repeat in your portal.`,
    });
    for (const m of list) {
      const marked = await admin.rpc("mark_run_out_reminded", { _medication: m.id, _run_out: m.runOut });
      if (!marked.error) medicines += 1;
    }
  }
  return { patients: byPatient.size, medicines };
}
