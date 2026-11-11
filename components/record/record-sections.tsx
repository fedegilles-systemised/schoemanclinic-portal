import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { ArchiveDocumentButton, ShareDocumentButton, UploadDocumentForm } from "@/components/documents/forms";
import { QuestionStatusPill } from "@/components/questions/question-parts";
import { AllergyForm, DiagnosisForm, DiagnosisStatusForm, ResolveAlertButton, SafeguardingForm } from "@/components/record/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import type { DocumentRow } from "@/lib/data/documents";
import type { AllergyRow, DiagnosisRow, MedicationRow, SafeguardingRow } from "@/lib/data/patient-record";
import type { QuestionSummary } from "@/lib/data/questions";
import { DOCUMENT_KIND_LABELS, UPLOAD_KINDS } from "@/lib/documents/constants";
import { formatDate } from "@/lib/format";
import { DIAGNOSIS_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/record/constants";

const listClass = "flex flex-col divide-y divide-surface-border border border-surface-border";

/** Safeguarding alerts at the top of the record, for doctors only (the database shows nobody else). */
export function SafeguardingSection({ patientId, alerts, today }: { patientId: string; alerts: SafeguardingRow[]; today: string }) {
  const active = alerts.filter((a) => a.status === "active");
  return (
    <section aria-labelledby="safeguarding" className="mb-12 flex flex-col gap-4">
      <SectionHeader id="safeguarding" title="Safeguarding" />
      {active.length === 0 ? (
        <EmptyState>No active safeguarding alerts.</EmptyState>
      ) : (
        <ul className={listClass}>
          {active.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={a.severity === "high" ? "danger" : "warning"} icon={ShieldAlert} label={SEVERITY_LABELS[a.severity]} />
                  <span>{a.alertType}</span>
                </div>
                <p className="type-body whitespace-pre-wrap">{a.note}</p>
                <span className="type-small text-content-muted">
                  {a.addedByName} · {formatDate(a.createdAt)}
                  {a.reviewDue ? ` · review by ${formatDate(a.reviewDue)}` : ""}
                </span>
              </div>
              <ResolveAlertButton patientId={patientId} alertId={a.id} />
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New safeguarding alert</CardTitle>
        </CardHeader>
        <CardContent>
          <SafeguardingForm patientId={patientId} today={today} />
        </CardContent>
      </Card>
    </section>
  );
}

/** Allergies, diagnoses and medicines. Medicines are read-only here until prescribing is connected. */
export function ClinicalSummarySection({
  patientId,
  allergies,
  diagnoses,
  medications,
  canAddAllergy,
  canDiagnose,
  today,
}: {
  patientId: string;
  allergies: AllergyRow[];
  diagnoses: DiagnosisRow[];
  medications: MedicationRow[];
  canAddAllergy: boolean;
  canDiagnose: boolean;
  today: string;
}) {
  return (
    <div className="mb-12 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="allergies" className="flex flex-col gap-4">
        <SectionHeader id="allergies" title="Allergies" />
        {allergies.length === 0 ? (
          <EmptyState>No allergies recorded.</EmptyState>
        ) : (
          <ul className={listClass}>
            {allergies.map((a) => (
              <li key={a.id} className="px-4 py-2">
                {a.substance}
                <span className="type-small text-content-muted">
                  {a.reaction ? ` · ${a.reaction}` : ""}
                  {a.severity ? ` · ${a.severity}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canAddAllergy ? <AllergyForm patientId={patientId} /> : null}
      </section>

      <section aria-labelledby="medications" className="flex flex-col gap-4">
        <SectionHeader id="medications" title="Medicines and " accent="supplements" />
        {medications.length === 0 ? (
          <EmptyState>No medicines or supplements recorded.</EmptyState>
        ) : (
          <ul className={listClass}>
            {medications.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {m.name}
                  <span className="type-small text-content-muted">
                    {m.dose ? ` · ${m.dose}` : ""} · {m.kind === "supplement" ? "supplement" : "prescription"} · since {formatDate(m.startDate)}
                  </span>
                </span>
                {m.status === "active" ? null : <Badge variant="outline">{m.status === "paused" ? "Paused" : "Stopped"}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <p className="type-small text-content-muted">Prescriptions are added through SignatureRx once it is connected.</p>
      </section>

      <section aria-labelledby="diagnoses" className="flex flex-col gap-4 lg:col-span-2">
        <SectionHeader id="diagnoses" title="Diagnoses" />
        {diagnoses.length === 0 ? (
          <EmptyState>No diagnoses recorded.</EmptyState>
        ) : (
          <ul className={listClass}>
            {diagnoses.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>
                  {d.label}
                  <span className="type-small text-content-muted">
                    {d.icd10Code ? ` · ${d.icd10Code}` : ""}
                    {d.diagnosedOn ? ` · ${formatDate(d.diagnosedOn)}` : ""}
                    {canDiagnose ? "" : ` · ${DIAGNOSIS_STATUS_LABELS[d.status]}`}
                  </span>
                  {d.notes ? <span className="type-small block text-content-muted">{d.notes}</span> : null}
                </span>
                {canDiagnose ? <DiagnosisStatusForm patientId={patientId} diagnosisId={d.id} status={d.status} /> : null}
              </li>
            ))}
          </ul>
        )}
        {canDiagnose ? (
          <Card>
            <CardHeader>
              <CardTitle>New diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <DiagnosisForm patientId={patientId} today={today} />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

/** Letters and documents on the record, and which the patient can see. */
export function DocumentsSection({ patientId, documents, canManage }: { patientId: string; documents: DocumentRow[]; canManage: boolean }) {
  return (
    <section aria-labelledby="documents" className="mb-12 flex flex-col gap-4">
      <SectionHeader id="documents" title="Letters and " accent="documents" />
      {documents.length === 0 ? (
        <EmptyState>No documents yet.</EmptyState>
      ) : (
        <ul className={listClass}>
          {documents.map((d) => {
            const manageable = canManage && (UPLOAD_KINDS as readonly string[]).includes(d.kind);
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>
                  <a href={`/clinic/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-content">
                    {d.title}
                  </a>
                  <span className="type-small text-content-muted">
                    {" "}
                    · {DOCUMENT_KIND_LABELS[d.kind]} · {formatDate(d.createdAt)} · {d.sharedWithPatient ? "shared with the patient" : "not shared"}
                  </span>
                </span>
                {manageable ? (
                  <div className="flex items-start gap-2">
                    <ShareDocumentButton documentId={d.id} patientId={patientId} shared={d.sharedWithPatient} />
                    <ArchiveDocumentButton documentId={d.id} patientId={patientId} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadDocumentForm patientId={patientId} />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

/** The patient's open questions, linking to the conversation. */
export function QuestionsSection({ questions }: { questions: QuestionSummary[] }) {
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="questions" className="mb-12 flex flex-col gap-4">
      <SectionHeader id="questions" title="Open " accent="questions" />
      <ul className={listClass}>
        {questions.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
            <Link href={`/clinic/questions/${q.id}`} className="text-content">
              {q.subject}
            </Link>
            <QuestionStatusPill status={q.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
