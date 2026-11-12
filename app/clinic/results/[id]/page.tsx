import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { z } from "zod";

import { CommentsForm, ReleaseForm } from "@/components/results/review-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { ResultStatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyStaffId } from "@/lib/data/patient-record";
import { getReport } from "@/lib/data/results";
import { formatDate, formatLongDate, formatRange } from "@/lib/format";
import { resultStatus, valueClass } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report · The Schoeman Clinic" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [report, user] = await Promise.all([getReport(id), getCurrentUser()]);
  if (!report) notFound();

  // Opening a patient's report is written to the activity log, once every ten minutes at most. If it
  // cannot be written the report is not shown: the clinic needs the log to be complete for CQC.
  const supabase = await createClient();
  const logged = await supabase.rpc("log_record_view", { _patient: report.patientId, _entity: "lab_reports", _entity_id: report.id });
  if (logged.error) throw new Error("Could not write to the activity log.");

  const isDoctor = Boolean(user?.roles.includes("doctor"));
  const released = report.releasedAt !== null;
  const myStaffId = isDoctor && user ? await getMyStaffId(user.id) : null;

  return (
    <>
      <Link href="/clinic/results" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All results
      </Link>
      <PageHeader
        eyebrow={`${report.clinicRef} · ${report.labName ?? "Lab report"}`}
        title={`${report.patientName} `}
        accent="results"
        description={`Sample taken ${report.sampleDate ? formatLongDate(report.sampleDate) : "on an unknown date"}. ${
          released ? `Released ${formatDate(report.releasedAt as string)}.` : "Not released: the patient cannot see it yet."
        }`}
      >
        {report.fileUrl ? (
          <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" className="type-button-label inline-flex items-center gap-2 text-content no-underline">
            <FileText className="size-4" aria-hidden />
            Open the lab&apos;s file
          </a>
        ) : null}
      </PageHeader>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Marker</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>As reported</TableHead>
            <TableHead>Range</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.results.map((result) => {
            const status = resultStatus(result.flag);
            return (
              <TableRow key={result.id}>
                <TableCell>{result.markerName}</TableCell>
                <TableCell className={cn("tabular-nums", valueClass(status))}>
                  {result.value} {result.unit ?? ""}
                </TableCell>
                <TableCell className="tabular-nums text-content-muted">
                  {result.originalValue !== null ? `${result.originalValue} ${result.originalUnit ?? ""}` : "-"}
                </TableCell>
                <TableCell className="tabular-nums text-content-muted">{formatRange(result.refLow, result.refHigh)}</TableCell>
                <TableCell>{status ? <ResultStatusPill status={status} /> : null}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {released ? (
        <section aria-labelledby="signoff" className="mt-10 max-w-3xl">
          <SectionHeader id="signoff" title="Sign-" accent="off" className="mb-3" />
          {report.signoff ? (
            <dl className="type-body grid gap-x-6 gap-y-2 border border-surface-border bg-surface-raised p-4 sm:grid-cols-[max-content_1fr]">
              <dt className="text-content-muted">Outcome</dt>
              <dd>{report.signoff.outcome === "action" ? "Action needed" : "No action needed"}</dd>
              {report.signoff.actionNote ? (
                <>
                  <dt className="text-content-muted">Action</dt>
                  <dd className="whitespace-pre-wrap">{report.signoff.actionNote}</dd>
                </>
              ) : null}
              <dt className="text-content-muted">Signed off by</dt>
              <dd>
                {report.signoff.signedByName}, {formatDate(report.signoff.signedAt)}
              </dd>
              <dt className="text-content-muted">Ordered by</dt>
              <dd>
                {report.signoff.orderedByName ?? "No order (outside results)"}
                {report.signoff.byOtherDoctor ? <span className="text-status-warning"> · signed off by a different doctor</span> : null}
              </dd>
            </dl>
          ) : (
            <p className="type-body text-content-muted">Released before sign-offs were recorded.</p>
          )}
        </section>
      ) : null}

      {isDoctor ? (
        <div className="mt-10 grid max-w-3xl gap-10">
          <section aria-labelledby="comments">
            <SectionHeader id="comments" title="Comments on " accent="markers" className="mb-3" />
            <CommentsForm
              reportId={report.id}
              fields={report.results.map((r) => ({ id: r.id, name: r.markerName, comment: r.doctorComment }))}
            />
          </section>
          {released ? null : (
            <section aria-labelledby="release">
              <SectionHeader id="release" title="Sign off and " accent="release" className="mb-3" />
              <ReleaseForm
                reportId={report.id}
                orderedBy={report.orderedBy ? { name: report.orderedBy.name, isYou: report.orderedBy.staffId === myStaffId } : null}
              />
            </section>
          )}
        </div>
      ) : released ? null : (
        <Alert variant="info" className="mt-8 max-w-3xl">
          <AlertDescription>A doctor reviews this report and releases it. Until then the patient cannot see it.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
