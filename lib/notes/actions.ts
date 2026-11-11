"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId } from "@/lib/data/patient-record";
import { createClient } from "@/lib/supabase/server";

export type NoteFormState = { error?: string; saved?: string };

const GENERIC_FAILURE = "We could not save that. Please try again.";
const WRITERS = ["doctor", "nurse", "health_coach"] as const;

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user || user.isSuspended || !user.roles.some((role) => (WRITERS as readonly string[]).includes(role))) redirect("/clinic");
  const staffId = await getMyStaffId(user.id);
  if (!staffId) redirect("/clinic");
  return { user, staffId };
}

/** The database's own messages for a refused change are written for people. Others are not shown. */
function friendly(error: { code?: string; message: string }): string {
  return ["42501", "22023", "23505"].includes(error.code ?? "") ? error.message : GENERIC_FAILURE;
}

const noteFields = z.object({
  title: z.string().trim().min(1, "Give the note a title.").max(200, "Use 200 characters or fewer for the title."),
  body: z.string().trim().min(1, "Write the note.").max(50000, "The note is too long."),
});

function read(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** A new draft, or a correction of a signed note when supersedesId is sent. */
export async function createNote(_state: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const { staffId } = await requireWriter();
  const patientId = z.uuid().safeParse(read(formData, "patientId"));
  const supersedes = read(formData, "supersedesId");
  const supersedesId = supersedes ? z.uuid().safeParse(supersedes) : null;
  if (!patientId.success || (supersedesId && !supersedesId.success)) return { error: GENERIC_FAILURE };
  const fields = noteFields.safeParse({ title: read(formData, "title"), body: read(formData, "body") });
  if (!fields.success) return { error: fields.error.issues[0]?.message ?? GENERIC_FAILURE };

  const supabase = await createClient();
  const { error } = await supabase.from("clinical_notes").insert({
    patient_id: patientId.data,
    author_id: staffId,
    title: fields.data.title,
    body: fields.data.body,
    supersedes_id: supersedesId?.success ? supersedesId.data : null,
  });
  if (error) return { error: error.code === "23505" ? "Someone is already correcting this note." : friendly(error) };
  revalidatePath(`/clinic/patients/${patientId.data}`);
  return { saved: supersedesId ? "Correction saved as a draft. Sign it to replace the earlier version." : "Draft saved. Sign it when it is final." };
}

export async function updateNote(_state: NoteFormState, formData: FormData): Promise<NoteFormState> {
  await requireWriter();
  const noteId = z.uuid().safeParse(read(formData, "noteId"));
  const patientId = z.uuid().safeParse(read(formData, "patientId"));
  if (!noteId.success || !patientId.success) return { error: GENERIC_FAILURE };
  const fields = noteFields.safeParse({ title: read(formData, "title"), body: read(formData, "body") });
  if (!fields.success) return { error: fields.error.issues[0]?.message ?? GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_notes")
    .update({ title: fields.data.title, body: fields.data.body })
    .eq("id", noteId.data)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "Only the author can change a draft, and a signed note cannot be changed." };
  revalidatePath(`/clinic/patients/${patientId.data}`);
  return { saved: "Draft saved." };
}

export async function signNote(_state: NoteFormState, formData: FormData): Promise<NoteFormState> {
  await requireWriter();
  const noteId = z.uuid().safeParse(read(formData, "noteId"));
  const patientId = z.uuid().safeParse(read(formData, "patientId"));
  if (!noteId.success || !patientId.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_clinical_note", { _note: noteId.data });
  if (error) return { error: friendly(error) };
  revalidatePath(`/clinic/patients/${patientId.data}`);
  return { saved: "Signed. The note is now locked." };
}

export async function archiveDraft(_state: NoteFormState, formData: FormData): Promise<NoteFormState> {
  await requireWriter();
  const noteId = z.uuid().safeParse(read(formData, "noteId"));
  const patientId = z.uuid().safeParse(read(formData, "patientId"));
  if (!noteId.success || !patientId.success) return { error: GENERIC_FAILURE };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", noteId.data)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: GENERIC_FAILURE };
  revalidatePath(`/clinic/patients/${patientId.data}`);
  return { saved: "Draft discarded." };
}
