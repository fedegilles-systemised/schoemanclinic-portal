import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CircleCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { isDay } from "@/lib/calendar/time";
import { listSignoffs, SIGNOFF_PAGE } from "@/lib/data/signoffs";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Results sign-offs · Clinic Hub" };

const day = (value: string | undefined) => (isDay(value) ? value : undefined);

/** Every results sign-off, for an inspection: who signed, when, and whether another doctor had ordered the tests. */
export default async function SignoffsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.roles.includes("admin")) redirect("/clinic");
  const query = await searchParams;
  const from = day(query.from);
  const to = day(query.to);
  const { rows, more } = await listSignoffs({ from, to });

  return (
    <>
      <PageHeader
        eyebrow="Clinic"
        title="Results "
        accent="sign-offs"
        description="Each time a doctor releases results they sign them off. This is the list an inspector may ask for. A sign-off is permanent and cannot be changed."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4">
        <Field id="from" label="From">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </Field>
        <Field id="to" label="To">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </Field>
        <Button type="submit" variant="outline">
          Show
        </Button>
        {from || to ? (
          <Link href="/clinic/signoffs" className="type-button-label text-content underline underline-offset-4">
            Clear dates
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No sign-offs{from || to ? " in those dates" : " yet"}.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signed</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Signed by</TableHead>
              <TableHead>Ordered by</TableHead>
              <TableHead>Signed by another doctor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.reportId}>
                <TableCell className="tabular-nums">{formatDate(r.signedAt)}</TableCell>
                <TableCell>
                  <Link href={`/clinic/results/${r.reportId}`} className="text-content underline underline-offset-4">
                    {r.patientName}
                  </Link>
                  <span className="type-small text-content-muted"> · {r.clinicRef}</span>
                </TableCell>
                <TableCell>
                  <StatusPill tone={r.outcome === "action" ? "warning" : "success"} icon={r.outcome === "action" ? TriangleAlert : CircleCheck} label={r.outcome === "action" ? "Action" : "No action"} />
                </TableCell>
                <TableCell>{r.signedByName}</TableCell>
                <TableCell>{r.orderedByName ?? "No order"}</TableCell>
                <TableCell>{r.orderedByName === null ? "Not applicable" : r.byOtherDoctor ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {more ? <p className="type-small mt-4 text-content-muted">Showing the {SIGNOFF_PAGE} most recent. Narrow the dates to see older ones.</p> : null}
    </>
  );
}
