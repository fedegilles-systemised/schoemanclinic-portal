import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Sparkline } from "@/components/ui/sparkline";
import { ResultStatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMyResults } from "@/lib/data/results";
import { formatDate, formatRange } from "@/lib/format";
import { resultStatus, valueClass } from "@/lib/results";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My results · The Schoeman Clinic" };

export default async function MyResultsPage() {
  const data = await getMyResults();

  return (
    <>
      <PageHeader
        eyebrow="My results"
        title="Your "
        accent="results"
        description="Results appear here once a doctor has reviewed them. Choose a marker to see how it has changed."
      />
      {!data || data.markers.length === 0 ? (
        <EmptyState>No results yet. When a doctor has reviewed your next set, it will appear here.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marker</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead>Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Taken</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.markers.map((marker) => {
              const latest = marker.points[marker.points.length - 1];
              const status = resultStatus(latest.flag);
              const tone = status === "out_of_range" ? "danger" : status === "borderline" ? "warning" : "default";
              return (
                <TableRow key={marker.markerId}>
                  <TableCell>
                    <Link href={`/portal/results/${marker.markerId}`} className="text-content underline underline-offset-2">
                      {marker.name}
                    </Link>
                  </TableCell>
                  <TableCell className={cn("tabular-nums", valueClass(status))}>
                    {latest.value} {marker.unit ?? ""}
                  </TableCell>
                  <TableCell className="tabular-nums text-content-muted">{formatRange(marker.refLow, marker.refHigh)}</TableCell>
                  <TableCell>{status ? <ResultStatusPill status={status} /> : null}</TableCell>
                  <TableCell>
                    <Sparkline values={marker.points.map((p) => p.value)} tone={tone} />
                  </TableCell>
                  <TableCell className="text-content-muted">{formatDate(latest.date)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
