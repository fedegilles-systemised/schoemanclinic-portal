"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { resultReadyEmail } from "@/lib/email/templates/app";
import { getEmailEnv } from "@/lib/env";
import { notifyPatient } from "@/lib/notify/patient";
import { createClient } from "@/lib/supabase/server";

export type ResultsFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not do that. Please try again.";
const TRY_LATER = "Too many attempts. Please wait a few minutes and try again.";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** The database's own messages for a refused entry are written for people. Others are not shown. */
function friendly(error: { code?: string; message: string }): string {
  return ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : GENERIC_FAILURE;
}

async function requireStaff(roles: readonly ("pa" | "doctor" | "nurse")[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (roles as readonly string[]).includes(role))) redirect("/clinic");
  return user;
}

/** Checks the first bytes, so a file's name or declared type is not taken on trust. */
function fileKind(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  const head = (n: number) => Array.from(bytes.slice(0, n));
  const text = String.fromCharCode(...head(5));
  if (text === "%PDF-") return "application/pdf";
  const h = head(4);
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return "image/jpeg";
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return "image/png";
  return null;
}

// Entering a report ---------------------------------------------------------------------------------------

const rowSchema = z.object({
  markerId: z.uuid("Choose a marker for every row."),
  value: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^-?\d{1,9}(\.\d{1,6})?$/, "Enter each value as a number, like 12.5.")),
  unit: z.string().trim().max(20).optional(),
});

const entrySchema = z.object({
  patientId: z.uuid("Choose a patient."),
  sampleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the sample date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now() && date.getUTCFullYear() >= 1990;
    }, "Enter a valid sample date."),
  labName: z.string().trim().max(120, "Use 120 characters or fewer for the lab name.").optional(),
  importId: z.uuid().optional(),
  documentId: z.uuid().optional(),
  rows: z.array(rowSchema).min(1, "Add at least one result.").max(80, "Add 80 results or fewer."),
});

export async function enterReport(_state: ResultsFormState, formData: FormData): Promise<ResultsFormState> {
  const user = await requireStaff(["pa", "doctor", "nurse"]);

  let rows: unknown = [];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: GENERIC_FAILURE };
  }
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const parsed = entrySchema.safeParse({
    patientId: text("patientId"),
    sampleDate: text("sampleDate"),
    labName: text("labName"),
    importId: text("importId"),
    documentId: text("documentId"),
    rows,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const input = parsed.data;
  if (!(await allowAuthAttempt("results-entry", user.email))) return { error: TRY_LATER };

  const supabase = await createClient();
  let documentId = input.documentId;
  let importId = input.importId;

  // A file sent with the form is filed under the patient first. If the entry then fails, the file
  // stays in the queue, so nothing is lost and the values can be entered again from there.
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return { error: "That file is over 10 MB. Send a smaller one." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = fileKind(bytes);
    if (!type) return { error: "Send a PDF, JPEG or PNG file." };
    const extension = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : "jpg";

    const path = `${input.patientId}/${randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("documents").upload(path, bytes, { contentType: type, upsert: false });
    if (upload.error) return { error: "The file could not be saved. Please try again." };

    const title = file.name.replace(/[^\w .()-]/g, "").slice(0, 120) || "Lab report";
    const document = await supabase
      .from("documents")
      .insert({
        patient_id: input.patientId,
        kind: "lab_report",
        title,
        storage_path: path,
        source: "staff_upload",
        uploaded_by: user.id,
        shared_with_patient: true,
      })
      .select("id")
      .single();
    if (document.error) return { error: GENERIC_FAILURE };
    documentId = document.data.id;

    const registered = await supabase.rpc("register_import", { _document_id: documentId });
    if (registered.error) return { error: friendly(registered.error) };
    importId = registered.data;
  }

  const entered = await supabase.rpc("enter_report", {
    _patient: input.patientId,
    _sample_date: input.sampleDate,
    _items: input.rows.map((row) => ({
      marker_id: row.markerId,
      value: Number(row.value),
      unit: row.unit ?? null,
    })),
    _lab_name: input.labName,
    _document_id: documentId,
    _import_id: importId,
  });
  if (entered.error) return { error: friendly(entered.error) };

  revalidatePath("/clinic", "layout");
  redirect(`/clinic/results/${entered.data}`);
}

// Comments and release --------------------------------------------------------------------------------------

const idSchema = z.uuid();

/** Saves a doctor's comment on each marker. Row-level security allows doctors only. */
export async function saveComments(_state: ResultsFormState, formData: FormData): Promise<ResultsFormState> {
  await requireStaff(["doctor"]);
  const reportId = idSchema.safeParse(formData.get("reportId"));
  if (!reportId.success) return { error: GENERIC_FAILURE };

  const supabase = await createClient();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("comment_") || typeof value !== "string") continue;
    const id = idSchema.safeParse(key.slice("comment_".length));
    if (!id.success) continue;
    const comment = value.trim();
    if (comment.length > 1000) return { error: "Use 1,000 characters or fewer for each comment." };
    const { error } = await supabase
      .from("results")
      .update({ doctor_comment: comment || null })
      .eq("id", id.data)
      .eq("lab_report_id", reportId.data);
    if (error) return { error: GENERIC_FAILURE };
  }
  revalidatePath(`/clinic/results/${reportId.data}`);
  return { saved: "Comments saved." };
}

export async function releaseReport(_state: ResultsFormState, formData: FormData): Promise<ResultsFormState> {
  await requireStaff(["doctor"]);
  const reportId = idSchema.safeParse(formData.get("reportId"));
  if (!reportId.success) return { error: GENERIC_FAILURE };
  const comment = String(formData.get("comment") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("release_report", { _report: reportId.data, _comment: comment || undefined });
  if (error) return { error: friendly(error) };

  revalidatePath("/clinic", "layout");
  revalidatePath("/portal", "layout");

  const problem = await tellPatientByEmail(supabase, reportId.data);
  return {
    saved: problem
      ? `The report has been released and the patient has been told in the portal. ${problem}`
      : "The report has been released. The patient has been told.",
  };
}

/**
 * Tells the patient a new result is ready: by email, and by WhatsApp if they turned it on. Neither
 * carries a value or verdict, only a link to sign in. A failure never undoes the release: the
 * portal notice is already saved, so the doctor is told and the patient still finds the result.
 */
async function tellPatientByEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportId: string,
): Promise<string | null> {
  const failure = "The message could not be sent, so they have not been emailed.";
  try {
    const report = await supabase
      .from("lab_reports")
      .select("patient_id, patient:patient_profiles(user_id, first_name)")
      .eq("id", reportId)
      .maybeSingle();
    if (report.error || !report.data) return failure;
    const patient = report.data.patient;
    if (!patient?.user_id) return "They have no account yet, so they have not been emailed.";
    const siteUrl = getEmailEnv().SITE_URL.replace(/\/$/, "");
    const portalUrl = `${siteUrl}/portal/results`;
    const delivery = await notifyPatient(report.data.patient_id, {
      topic: "results",
      email: resultReadyEmail({ siteUrl, firstName: patient.first_name, portalUrl }),
      whatsapp: `Hello ${patient.first_name}, a doctor at The Schoeman Clinic has shared a new result with you. Sign in to see it: ${portalUrl}`,
    });
    if (delivery.email === "off") return "They have switched results emails off, so they have not been emailed.";
    if (delivery.email === "no-address") return "There is no email address for them, so they have not been emailed.";
    if (delivery.email !== "sent") return failure;
    return null;
  } catch {
    // Nothing here may undo or hide a release that has already happened.
    console.error("Result message not sent: something went wrong before it could be sent.");
    return failure;
  }
}
