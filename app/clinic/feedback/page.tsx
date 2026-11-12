import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RatingPill } from "@/components/feedback/parts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { listAnsweredFeedback, type FeedbackRow } from "@/lib/data/feedback";
import { addDays, formatDate, londonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Feedback · Clinic Hub" };

function FeedbackTable({ rows, showDue }: { rows: FeedbackRow[]; showDue: boolean }) {
  const today = londonDate();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Answered</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Rating</TableHead>
          {showDue ? <TableHead>Follow up by</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link href={`/clinic/feedback/${r.id}`} className="text-content">
                {r.patientName}
              </Link>
              <span className="type-small text-content-muted"> · {r.clinicRef}</span>
            </TableCell>
            <TableCell className="tabular-nums">{r.answeredAt ? formatDate(r.answeredAt) : ""}</TableCell>
            <TableCell className="tabular-nums">{r.score ?? ""}</TableCell>
            <TableCell>
              {r.rating ? <RatingPill rating={r.rating} /> : null}
              {r.rating === "green" && r.mayQuote && (r.wentWell || r.couldImprove) && !r.quoteChecked ? (
                <span className="type-small block text-content-muted">Not checked</span>
              ) : null}
            </TableCell>
            {showDue ? (
              <TableCell className={r.followUpDue && r.followUpDue < today ? "font-medium text-status-danger" : undefined}>
                {r.followUpDue ? formatDate(r.followUpDue) : ""}
                {r.followUpDue && r.followUpDue < today ? " (overdue)" : ""}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Patient feedback: amber and red answers waiting for a follow-up, then everything recent. For
 * admins, PAs and doctors; doctors see their own care team's patients.
 */
export default async function ClinicFeedbackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.some((r) => r === "admin" || r === "pa" || r === "doctor")) redirect("/clinic");
  const rows = await listAnsweredFeedback();
  const toFollowUp = rows
    .filter((r) => (r.rating === "amber" || r.rating === "red") && !r.followUp)
    .sort((a, b) => (a.followUpDue ?? "").localeCompare(b.followUpDue ?? ""));
  const since = addDays(londonDate(), -90);
  const recent = rows.filter((r) => r.answeredAt && londonDate(new Date(r.answeredAt)) >= since);
  const count = (rating: string) => recent.filter((r) => r.rating === rating).length;
  const toCheck = rows.filter((r) => r.rating === "green" && r.mayQuote && (r.wentWell || r.couldImprove) && !r.quoteChecked).length;

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="Patient "
        accent="feedback"
        description={`Last 90 days: ${recent.length} ${recent.length === 1 ? "answer" : "answers"}, ${count("green")} positive, ${count("amber")} mixed and ${count("red")} needing attention. Every patient who answers is offered the Google review link.`}
      >
        <div className="flex flex-wrap gap-6">
          <Link href="/clinic/feedback/export?set=evidence" prefetch={false} className="type-button-label text-content no-underline">
            Download the CQC evidence (CSV)
          </Link>
          <Link href="/clinic/feedback/export?set=all" prefetch={false} className="type-button-label text-content no-underline">
            Download the full log (CSV)
          </Link>
        </div>
      </PageHeader>

      {toCheck > 0 ? (
        <p className="type-body mb-6">
          {toCheck} positive {toCheck === 1 ? "comment is" : "comments are"} waiting to be checked before {toCheck === 1 ? "it goes" : "they go"} into the CQC
          evidence. Open {toCheck === 1 ? "it" : "each one"} from the table below, marked &ldquo;Not checked&rdquo;.
        </p>
      ) : null}

      <section aria-labelledby="follow-up" className="mb-12 flex flex-col gap-4">
        <SectionHeader id="follow-up" title="Waiting for a " accent="follow-up" />
        {toFollowUp.length === 0 ? <EmptyState>Nothing waiting.</EmptyState> : <FeedbackTable rows={toFollowUp} showDue />}
      </section>

      <section aria-labelledby="recent" className="flex flex-col gap-4">
        <SectionHeader id="recent" title="Latest " accent="answers" />
        {rows.length === 0 ? <EmptyState>No feedback yet.</EmptyState> : <FeedbackTable rows={rows.slice(0, 100)} showDue={false} />}
      </section>
    </>
  );
}
