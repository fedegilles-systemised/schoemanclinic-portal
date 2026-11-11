import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getResultsQueue, type ReportRow } from "@/lib/data/results";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Results · The Schoeman Clinic" };

function ReportsTable({ rows, released }: { rows: ReportRow[]; released?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Lab</TableHead>
          <TableHead>Sample date</TableHead>
          <TableHead>Results</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/clinic/results/${row.id}`} className="text-content underline underline-offset-2">
                {row.patientName}
              </Link>
              <div className="type-small text-content-muted">{row.clinicRef}</div>
            </TableCell>
            <TableCell className="text-content-muted">{row.labName ?? "-"}</TableCell>
            <TableCell>{row.sampleDate ? formatDate(row.sampleDate) : "-"}</TableCell>
            <TableCell className="tabular-nums">
              {row.resultCount}
              {row.outOfRangeCount > 0 ? <span className="text-status-danger"> · {row.outOfRangeCount} out of range</span> : null}
            </TableCell>
            <TableCell>
              {released ? (
                <StatusPill tone="success" icon={Check} label={`Released ${row.releasedAt ? formatDate(row.releasedAt) : ""}`.trim()} />
              ) : (
                <StatusPill tone="info" icon={Clock} label="Awaiting review" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Row-level security decides what each role sees: a health coach reads released reports only. */
export default async function ResultsPage() {
  const user = await getCurrentUser();
  const canEnter = Boolean(user?.roles.some((role) => role === "pa" || role === "doctor" || role === "nurse"));
  const queue = await getResultsQueue();

  return (
    <>
      <PageHeader eyebrow="Patients" title="Results " accent="review" description="Enter what a lab sent, then a doctor reviews and releases it.">
        {canEnter ? (
          <Button asChild>
            <Link href="/clinic/results/new">
              <Plus aria-hidden />
              Add results
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {canEnter ? (
        <section className="mb-12" aria-labelledby="imports">
          <SectionHeader id="imports" title="Files waiting " accent="for entry" className="mb-3" />
          {queue.imports.length === 0 ? (
            <EmptyState>No files are waiting.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.imports.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="text-content-muted">{item.patientName}</TableCell>
                    <TableCell>{formatDate(item.receivedAt)}</TableCell>
                    <TableCell>
                      {item.matched ? (
                        <Link href={`/clinic/results/new?import=${item.id}`} className="type-button-label text-content no-underline">
                          Enter values
                        </Link>
                      ) : (
                        <span className="type-small text-content-muted">Needs matching to a patient</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}

      <section className="mb-12" aria-labelledby="awaiting">
        <SectionHeader id="awaiting" title="To " accent="review" className="mb-3" />
        {queue.awaiting.length === 0 ? <EmptyState>Nothing is waiting for review.</EmptyState> : <ReportsTable rows={queue.awaiting} />}
      </section>

      <section aria-labelledby="released">
        <SectionHeader id="released" title="Recently " accent="released" className="mb-3" />
        {queue.released.length === 0 ? <EmptyState>No reports have been released yet.</EmptyState> : <ReportsTable rows={queue.released} released />}
      </section>
    </>
  );
}
