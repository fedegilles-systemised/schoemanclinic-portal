import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { z } from "zod";

import { CorrectNote, DraftForm, NewNoteForm } from "@/components/notes/note-forms";
import { RELATIONSHIP_LABELS } from "@/components/patients/care-team-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId, getPatientRecord } from "@/lib/data/patient-record";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patient · The Schoeman Clinic" };

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

/** A patient's record for the clinic: who looks after them, and their clinical notes. */
export default async function PatientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  const record = await getPatientRecord(id);
  if (!record) notFound();

  // Opening a patient's record is written to the activity log. If it cannot be written the record
  // is not shown: the clinic needs the log to be complete for CQC.
  const supabase = await createClient();
  const logged = await supabase.rpc("log_record_view", { _patient: record.id, _entity: "patient_profiles" });
  if (logged.error) throw new Error("Could not write to the activity log.");

  const canWrite = user.roles.some((role) => role === "doctor" || role === "nurse" || role === "health_coach");
  const myStaffId = canWrite ? await getMyStaffId(user.id) : null;
  const drafts = record.notes.filter((note) => note.status === "draft");
  const signed = record.notes.filter((note) => note.status === "signed");

  return (
    <>
      <Link href="/clinic/patients" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All patients
      </Link>
      <PageHeader
        eyebrow={record.clinicRef}
        title={`${record.name} `}
        accent="record"
        description={`Born ${formatDate(record.dateOfBirth)}. Care team: ${
          record.careTeam.length ? record.careTeam.map((m) => `${m.name} (${RELATIONSHIP_LABELS[m.relationship]})`).join(", ") : "nobody yet"
        }.`}
      />

      <section aria-labelledby="notes" className="flex flex-col gap-6">
        <SectionHeader id="notes" title="Clinical " accent="notes" />

        {canWrite && myStaffId ? (
          <Card>
            <CardHeader>
              <CardTitle>New note</CardTitle>
            </CardHeader>
            <CardContent>
              <NewNoteForm patientId={record.id} />
            </CardContent>
          </Card>
        ) : null}

        {drafts.map((note) => (
          <Card key={note.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{note.title}</CardTitle>
                <Badge variant="outline">Draft{note.version > 1 ? `, version ${note.version}` : ""}</Badge>
                {note.source === "recording" ? <Badge variant="neutral">From a recording</Badge> : null}
              </div>
              <div className="type-small text-content-muted">
                {note.authorName} · last saved {dateTime(note.updatedAt)}
              </div>
            </CardHeader>
            <CardContent>
              {note.authorId === myStaffId ? (
                <DraftForm patientId={record.id} noteId={note.id} title={note.title} body={note.body} />
              ) : (
                <p className="type-body whitespace-pre-wrap">{note.body}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {signed.length === 0 && drafts.length === 0 ? <EmptyState>No notes yet.</EmptyState> : null}

        {signed.map((note) => (
          <Card key={note.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{note.title}</CardTitle>
                <Badge variant="neutral">
                  <Lock className="size-3" aria-hidden /> Signed{note.version > 1 ? `, version ${note.version}` : ""}
                </Badge>
                {note.correctedBy ? <Badge variant="outline">Corrected by a later version</Badge> : null}
                {note.source === "recording" ? <Badge variant="neutral">From a recording</Badge> : null}
              </div>
              <div className="type-small text-content-muted">
                {note.authorName} · signed {note.signedAt ? dateTime(note.signedAt) : ""}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="type-body whitespace-pre-wrap">{note.body}</p>
              {canWrite && myStaffId && !note.correctedBy ? (
                <CorrectNote patientId={record.id} noteId={note.id} title={note.title} body={note.body} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
