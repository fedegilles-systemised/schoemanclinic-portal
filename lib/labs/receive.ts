import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { namesAgree, type LabReport } from "@/lib/labs/parse";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReceivedLabFile = { status: "accepted"; matched: boolean } | { status: "duplicate" };

/**
 * Files one lab PDF. The patient is found by email and date of birth only when exactly one matches;
 * otherwise the file waits under unmatched/ for a PA. The file is stored first, then recorded in one
 * database call; if that fails the file is removed again, and the lab is told to try again.
 */
export async function receiveLabFile(provider: string, bytes: Uint8Array, report: LabReport): Promise<ReceivedLabFile> {
  const admin = createAdminClient();
  // A lab that sends no id of its own is identified by the file itself.
  const reportId = report.reportId ?? createHash("sha256").update(bytes).digest("hex").slice(0, 32);

  const earlier = await admin.from("result_imports").select("id").eq("source_provider", provider).eq("source_report_id", reportId).maybeSingle();
  if (earlier.error) throw new Error("Could not check for an earlier copy.");
  if (earlier.data) return { status: "duplicate" };

  const found = await admin.rpc("find_patient_for_lab", { _email: report.email ?? "", _dob: report.dateOfBirth as string });
  if (found.error) throw new Error("Could not look for the patient.");
  let patientId: string | null = found.data ?? null;
  if (patientId) {
    // Email and date of birth find the patient; the name must agree too, or a person looks at it first.
    const who = await admin.from("patient_profiles").select("first_name, last_name").eq("id", patientId).maybeSingle();
    if (who.error) throw new Error("Could not look for the patient.");
    if (!who.data || !namesAgree(report.name, who.data.first_name, who.data.last_name)) patientId = null;
  }

  const path = `${patientId ?? "unmatched"}/${randomUUID()}.pdf`;
  const uploaded = await admin.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploaded.error) throw new Error("Could not store the file.");

  const title = [report.testName ?? "Lab report", report.sampleDate].filter(Boolean).join(" ").slice(0, 120);
  const recorded = await admin.rpc("receive_lab_file", {
    _provider: provider,
    _external_id: reportId,
    _patient: patientId as string,
    _storage_path: path,
    _title: title,
    _name: report.name as string,
    _email: report.email as string,
    _dob: report.dateOfBirth as string,
    _sample_date: report.sampleDate as string,
    _test_name: report.testName as string,
  });
  const row = recorded.data?.[0];
  if (recorded.error || !row) {
    await admin.storage.from("documents").remove([path]);
    throw new Error("Could not record the file.");
  }
  if (!row.is_new) {
    // Two copies arrived together: the first one is the one recorded.
    await admin.storage.from("documents").remove([path]);
    return { status: "duplicate" };
  }
  return { status: "accepted", matched: patientId !== null };
}
