import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { getCurrentUser } from "@/lib/auth/session";
import { ACTIVITY_PAGE, getActivity } from "@/lib/data/activity";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Activity · The Schoeman Clinic" };

const ACTIONS: Record<string, string> = {
  viewed: "Opened",
  created: "Added",
  updated: "Changed",
  deleted: "Removed",
  released: "Released",
  exported: "Downloaded",
};

const ENTITIES: Record<string, string> = {
  patient_profiles: "Patient record",
  lab_reports: "Lab report",
  results: "Result",
  documents: "Document",
  lab_orders: "Lab order",
  lab_report_signoffs: "Results sign-off",
  patient_feedback: "Patient feedback",
  feedback_follow_ups: "Feedback follow-up",
  form_submissions: "Submitted form",
};

function words(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** For admins only: who opened or changed a record, and when. The database refuses anyone else. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isAdmin) redirect("/clinic");

  const { before } = await searchParams;
  const cursor = before && /^\d{1,15}$/.test(before) ? Number(before) : undefined;
  const rows = await getActivity(cursor);
  const last = rows[rows.length - 1];

  return (
    <>
      <PageHeader
        eyebrow="Team and settings"
        title="Record "
        accent="activity"
        description="Who opened or changed a patient's record, and when. The log holds no clinical values and cannot be edited."
      />
      {rows.length === 0 ? (
        <EmptyState>No activity yet. Opening or changing a record will appear here.</EmptyState>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Patient</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums">
                    {formatDate(row.at)}
                    <div className="type-small text-content-muted">{formatTime(row.at)}</div>
                  </TableCell>
                  <TableCell>
                    {row.actorName}
                    {row.actorRole ? <div className="type-small text-content-muted">{ROLE_LABELS[row.actorRole]}</div> : null}
                  </TableCell>
                  <TableCell>
                    {ACTIONS[row.action] ?? words(row.action)}
                    <div className="type-small text-content-muted">{ENTITIES[row.entity] ?? words(row.entity)}</div>
                  </TableCell>
                  <TableCell className="text-content-muted">
                    {row.patientName ? (
                      <>
                        <span className="text-content">{row.patientName}</span>
                        <div className="type-small">{row.patientRef}</div>
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === ACTIVITY_PAGE && last ? (
            <div className="mt-6">
              <Link href={`/clinic/activity?before=${last.id}`} className="type-table text-secondary underline underline-offset-4">
                Older activity
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
