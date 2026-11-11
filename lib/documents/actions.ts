"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { allowAuthAttempt } from "@/lib/auth/throttle";
import { UPLOAD_KINDS } from "@/lib/documents/constants";
import { documentSharedEmail } from "@/lib/email/templates/app";
import { getSiteUrl } from "@/lib/env";
import { extensionFor, fileKind, MAX_FILE_BYTES } from "@/lib/files";
import { notifyPatient, type Delivery } from "@/lib/notify/patient";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DocumentFormState = { error?: string; saved?: string; sentAt?: number };

const GENERIC_FAILURE = "We could not do that. Please try again.";

/** Doctors, nurses and PAs add and share documents; the database checks the patient is theirs. */
async function requireDocumentStaff() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => role === "doctor" || role === "nurse" || role === "pa")) redirect("/clinic");
  return user;
}

async function tellPatient(patientId: string): Promise<Delivery | null> {
  try {
    const admin = createAdminClient();
    const patient = await admin.from("patient_profiles").select("first_name").eq("id", patientId).maybeSingle();
    const siteUrl = getSiteUrl();
    return await notifyPatient(patientId, {
      topic: "messages",
      notice: { title: "A new document", body: "The clinic has shared a document with you.", link: "/portal/documents" },
      email: documentSharedEmail({ siteUrl, firstName: patient.data?.first_name, portalUrl: `${siteUrl}/portal/documents` }),
      whatsapp: `Hello ${patient.data?.first_name ?? ""}, the clinic has shared a new document with you. Please sign in to your portal to read it.`,
    });
  } catch {
    console.error("Document follow-up not completed.");
    return null;
  }
}

function sharedLine(delivery: Delivery | null): string {
  if (!delivery) return "Shared. The patient could not be told; please let them know.";
  if (delivery.email === "suspended") return "Shared. The patient's account is not active, so they were not told.";
  if (delivery.email === "sent" || delivery.whatsapp === "sent") return "Shared, and the patient has been told.";
  return "Shared. The patient could not be told by email or WhatsApp; please let them know.";
}

/** A letter, referral or other document for one patient, kept private until shared. */
export async function uploadDocument(_state: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const user = await requireDocumentStaff();
  const parsed = z
    .object({
      patientId: z.uuid(),
      title: z.string().trim().min(1, "Give the document a title.").max(120, "Use 120 characters or fewer for the title."),
      kind: z.enum(UPLOAD_KINDS, "Choose what kind of document it is."),
      share: z.boolean(),
    })
    .safeParse({
      patientId: formData.get("patientId"),
      title: formData.get("title"),
      kind: formData.get("kind"),
      share: formData.get("share") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 10 MB. Send a smaller one." };
  if (!(await allowAuthAttempt("document-upload", user.email))) return { error: "Too many uploads at once. Please wait a while and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileKind(bytes);
  if (!type) return { error: "Send a PDF, JPEG or PNG file." };

  const supabase = await createClient();
  const { patientId, title, kind, share } = parsed.data;
  const path = `${patientId}/${randomUUID()}.${extensionFor(type)}`;
  const upload = await supabase.storage.from("documents").upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) return { error: "The file could not be saved. Please try again." };
  const { error } = await supabase.from("documents").insert({
    patient_id: patientId,
    kind,
    title,
    storage_path: path,
    source: "staff_upload",
    uploaded_by: user.id,
    shared_with_patient: share,
    shared_at: share ? new Date().toISOString() : null,
  });
  if (error) return { error: GENERIC_FAILURE };

  revalidatePath(`/clinic/patients/${patientId}`);
  if (!share) return { saved: "Document added. It is not shared with the patient yet.", sentAt: Date.now() };
  return { saved: sharedLine(await tellPatient(patientId)), sentAt: Date.now() };
}

/** Shares a document with the patient, or takes it back. Taking it back hides it at once. */
export async function setDocumentShared(_state: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  await requireDocumentStaff();
  const parsed = z
    .object({ documentId: z.uuid(), patientId: z.uuid(), share: z.enum(["yes", "no"]) })
    .safeParse({ documentId: formData.get("documentId"), patientId: formData.get("patientId"), share: formData.get("share") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const share = parsed.data.share === "yes";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ shared_with_patient: share, shared_at: share ? new Date().toISOString() : null })
    .eq("id", parsed.data.documentId)
    .eq("patient_id", parsed.data.patientId)
    .in("kind", [...UPLOAD_KINDS])
    .select("id");
  if (error || !data?.length) return { error: "You cannot change this document." };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  if (!share) return { saved: "No longer shared." };
  return { saved: sharedLine(await tellPatient(parsed.data.patientId)) };
}

/** Archives a document added by mistake. Nothing is deleted. */
export async function archiveDocument(_state: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  await requireDocumentStaff();
  const parsed = z.object({ documentId: z.uuid(), patientId: z.uuid() }).safeParse({ documentId: formData.get("documentId"), patientId: formData.get("patientId") });
  if (!parsed.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ archived_at: new Date().toISOString(), shared_with_patient: false })
    .eq("id", parsed.data.documentId)
    .eq("patient_id", parsed.data.patientId)
    .in("kind", [...UPLOAD_KINDS])
    .select("id");
  if (error || !data?.length) return { error: "You cannot remove this document." };
  revalidatePath(`/clinic/patients/${parsed.data.patientId}`);
  return { saved: "Document removed." };
}
