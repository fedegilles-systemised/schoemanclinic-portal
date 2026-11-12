import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { z } from "zod";

import { AssignCourseForm, UnassignButton } from "@/components/education/forms";
import { AppointmentsTable } from "@/components/booking/appointments-table";
import { CancelAppointmentButton } from "@/components/booking/book-slot";
import { DraftForm, NewNoteForm } from "@/components/notes/note-forms";
import { CheckRecordingButton, Recorder } from "@/components/recordings/recorder";
import { RELATIONSHIP_LABELS } from "@/components/patients/care-team-forms";
import { RemoveGuardianButton } from "@/components/patients/guardian-forms";
import { FormList } from "@/components/forms/form-list";
import { ClinicalSummarySection, ConsentsSection, DocumentsSection, QuestionsSection, SafeguardingSection } from "@/components/record/record-sections";
import { ReadingsTable } from "@/components/wearables/readings-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOption, OPTION_CHECKS, type TreatmentOptions } from "@/lib/notes/options";
import { getUpcomingAppointments } from "@/lib/data/appointments";
import { getPatientAssignments, getReadings, listCourses } from "@/lib/data/education";
import { getConsents } from "@/lib/data/consents";
import { listDocuments } from "@/lib/data/documents";
import { getCatalogue } from "@/lib/data/prescriptions";
import { listForms, submitterLabels } from "@/lib/data/forms";
import { getClinicalSummary, getGuardians, getMyStaffId, getPatientRecord, getRecordings, getSafeguardingAlerts } from "@/lib/data/patient-record";
import { listQuestions } from "@/lib/data/questions";
import { todayInLondon } from "@/lib/calendar/time";
import { isTranscriptionConfigured } from "@/lib/env";
import { RELATIONSHIP_LABELS as GUARDIAN_LABELS } from "@/lib/invitations/constants";
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

/** The treatment-option confirmations on a signed note: each one said in words, ticked or not. */
function NoteOptions({ options }: { options: TreatmentOptions }) {
  if (!hasAnyOption(options)) return <p className="type-small mt-4 text-content-muted">No treatment options were recorded on this note.</p>;
  return (
    <div className="mt-4 border-t border-surface-border pt-4">
      <h4 className="type-eyebrow mb-2 text-content-muted">Treatment options</h4>
      <ul className="type-small flex flex-col gap-1">
        {OPTION_CHECKS.map(([key, , label]) => (
          <li key={key}>
            {options[key] ? "Yes" : "No"}: {label}
          </li>
        ))}
      </ul>
      {options.optionsOffered ? <p className="type-small mt-2 whitespace-pre-wrap">Options offered: {options.optionsOffered}</p> : null}
    </div>
  );
}

/** A patient's record for the clinic: who looks after them, and their clinical notes. */
export default async function PatientRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const { id } = await params;
  const { booked } = await searchParams;
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
  const isDoctor = user.roles.includes("doctor");
  const canManageDocuments = user.roles.some((role) => role === "doctor" || role === "nurse" || role === "pa");
  const today = todayInLondon();
  const myStaffId = canWrite ? await getMyStaffId(user.id) : null;
  const [assignments, library, readings, appointments, summary, documents, questions, safeguarding, consents, medicineList, forms] = await Promise.all([
    getPatientAssignments(record.id),
    listCourses(),
    getReadings(record.id, 30),
    getUpcomingAppointments(record.id),
    getClinicalSummary(record.id),
    listDocuments(record.id, { sharedOnly: false }),
    listQuestions({ patientId: record.id, open: true }),
    isDoctor ? getSafeguardingAlerts(record.id) : Promise.resolve([]),
    getConsents(record.id),
    isDoctor ? getCatalogue() : Promise.resolve([]),
    listForms(id),
  ]);
  const formSubmitters = await submitterLabels(record.id, forms);
  const assignable = library.filter((course) => course.published && !assignments.some((a) => a.courseId === course.id));
  const recordings = await getRecordings(record.id);
  const canRecord = canWrite && Boolean(myStaffId) && isTranscriptionConfigured();
  const RECORDING_STATUS = { uploading: "Upload did not finish; record again", transcribing: "Being transcribed", transcribed: "Transcript in notes", failed: "Transcription failed" } as const;
  const managesGuardians = user.roles.some((role) => role === "pa" || role === "admin");
  const guardians = managesGuardians ? await getGuardians(record.id) : [];
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

      {booked ? (
        <div className="mb-6">
          <Alert variant="success">
            <AlertDescription>
              {booked === "told" ? "Appointment booked, and the patient has been sent a confirmation." : "Appointment booked. The patient could not be messaged, so please let them know."}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {isDoctor ? <SafeguardingSection patientId={record.id} alerts={safeguarding} today={today} /> : null}

      <ClinicalSummarySection
        patientId={record.id}
        allergies={summary.allergies}
        diagnoses={summary.diagnoses}
        medications={summary.medications}
        canAddAllergy={canManageDocuments}
        canDiagnose={isDoctor}
        canPrescribe={isDoctor}
        listNames={medicineList.map((m) => m.name)}
        today={today}
      />

      <QuestionsSection questions={questions} />

      <section aria-labelledby="forms" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="forms" title="Submitted " accent="forms" />
        {forms.length === 0 ? (
          <EmptyState>No forms yet. Repeat requests, questions and feedback appear here as they are sent.</EmptyState>
        ) : (
          <FormList forms={forms} submitterName={(form) => formSubmitters.get(form.submittedBy) ?? null} />
        )}
      </section>

      <ConsentsSection consents={consents} />

      <section aria-labelledby="appointments" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="appointments" title="Appointments">
          <Link href={`/clinic/patients/${record.id}/book`} className="type-button-label text-content no-underline">
            Book an appointment
          </Link>
        </SectionHeader>
        {appointments.length === 0 ? (
          <EmptyState>No upcoming appointments.</EmptyState>
        ) : (
          <AppointmentsTable
            rows={appointments}
            action={(row) =>
              row.status === "booked" || row.status === "confirmed" ? (
                <CancelAppointmentButton appointmentId={row.id} patientId={record.id} label={`${row.type} on ${formatDate(row.startsAt)}`} />
              ) : null
            }
          />
        )}
      </section>

      <div className="mb-12 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="education" className="flex flex-col gap-4">
          <SectionHeader id="education" title="Education " accent="courses" />
          {assignments.length === 0 ? (
            <EmptyState>No courses on their portal yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>
                    {a.title}
                    {a.published ? null : <span className="type-small text-content-muted"> · draft, not visible yet</span>}
                  </span>
                  <UnassignButton patientId={record.id} assignmentId={a.id} title={a.title} />
                </li>
              ))}
            </ul>
          )}
          <AssignCourseForm patientId={record.id} courses={assignable.map((c) => ({ id: c.id, title: c.title }))} />
        </section>
        <section aria-labelledby="wearables" className="flex flex-col gap-4">
          <SectionHeader id="wearables" title="Wearable " accent="readings" />
          {readings.length === 0 ? <EmptyState>The patient has not added any readings.</EmptyState> : <ReadingsTable readings={readings} />}
        </section>
      </div>

      <DocumentsSection patientId={record.id} documents={documents} canManage={canManageDocuments} />

      {managesGuardians ? (
        <section aria-labelledby="guardians" className="mb-12 flex flex-col gap-4">
          <SectionHeader id="guardians" title="Guardians" />
          {guardians.length === 0 ? (
            <EmptyState>No guardian can see this patient&apos;s account.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
              {guardians.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span>
                    {g.name}
                    <span className="type-small text-content-muted">
                      {" "}
                      · {GUARDIAN_LABELS[g.relationship as keyof typeof GUARDIAN_LABELS] ?? g.relationship} · {g.canAct ? "can act" : "can view"}
                      {g.email ? ` · ${g.email}` : ""}
                    </span>
                  </span>
                  <RemoveGuardianButton patientId={record.id} linkId={g.id} name={g.name} />
                </li>
              ))}
            </ul>
          )}
          <p className="type-small text-content-muted">Patients cannot remove a guardian themselves. New guardians are invited from Team and settings.</p>
        </section>
      ) : null}

      <section aria-labelledby="notes" className="flex flex-col gap-6">
        <SectionHeader id="notes" title="Clinical " accent="notes" />

        {canRecord ? (
          <Card>
            <CardHeader>
              <CardTitle>Record a call</CardTitle>
            </CardHeader>
            <CardContent>
              <Recorder patientId={record.id} />
            </CardContent>
          </Card>
        ) : null}

        {recordings.some((r) => r.status !== "transcribed") ? (
          <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
            {recordings
              .filter((r) => r.status !== "transcribed")
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                  <span>
                    Call recorded {dateTime(r.createdAt)}
                    <span className="type-small text-content-muted"> · {RECORDING_STATUS[r.status]}</span>
                  </span>
                  {r.recordedBy === myStaffId && r.status !== "uploading" ? (
                    <CheckRecordingButton recordingId={r.id} patientId={record.id} failed={r.status === "failed"} />
                  ) : null}
                </li>
              ))}
          </ul>
        ) : null}

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
                <Badge variant="outline">Draft</Badge>
                {note.source === "recording" ? <Badge variant="neutral">From a recording</Badge> : null}
              </div>
              <div className="type-small text-content-muted">
                {note.authorName} · last saved {dateTime(note.updatedAt)}
              </div>
            </CardHeader>
            <CardContent>
              {note.authorId === myStaffId ? (
                <DraftForm patientId={record.id} noteId={note.id} title={note.title} body={note.body} options={note.options} />
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
                  <Lock className="size-3" aria-hidden /> Signed, final
                </Badge>
                {note.source === "recording" ? <Badge variant="neutral">From a recording</Badge> : null}
              </div>
              <div className="type-small text-content-muted">
                {note.authorName} · signed {note.signedAt ? dateTime(note.signedAt) : ""}
              </div>
            </CardHeader>
            <CardContent>
              <p className="type-body whitespace-pre-wrap">{note.body}</p>
              <NoteOptions options={note.options} />
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
