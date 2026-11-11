import "server-only";

import type { DocumentKind } from "@/lib/documents/constants";
import { createClient } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  title: string;
  kind: DocumentKind;
  createdAt: string;
  sharedWithPatient: boolean;
  sharedAt: string | null;
};

/**
 * One patient's documents. In the portal row-level security returns only what is shared and, for a
 * lab report, released; in the clinic, everything on a patient the person can open. Archived ones
 * are left out either way.
 */
export async function listDocuments(patientId: string, { sharedOnly }: { sharedOnly: boolean }): Promise<DocumentRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("id, title, kind, created_at, shared_with_patient, shared_at")
    .eq("patient_id", patientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (sharedOnly) query = query.eq("shared_with_patient", true);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the documents.");
  return data.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    createdAt: d.created_at,
    sharedWithPatient: d.shared_with_patient,
    sharedAt: d.shared_at,
  }));
}

/**
 * A short-lived link to one document's file, through the person's own session: Storage serves the
 * file only when they can read its row. Staff opening a file is written to the activity log first.
 */
export async function signedDocumentUrl(documentId: string, { logAs }: { logAs: "staff" | "patient" }): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("storage_path, patient_id")
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return null;
  if (logAs === "staff" && data.patient_id) {
    const logged = await supabase.rpc("log_record_view", { _patient: data.patient_id, _entity: "documents", _entity_id: documentId });
    if (logged.error) return null;
  }
  const signed = await supabase.storage.from("documents").createSignedUrl(data.storage_path, 60);
  return signed.error ? null : signed.data.signedUrl;
}
