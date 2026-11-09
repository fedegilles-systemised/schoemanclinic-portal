import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TrendChart } from "@/components/results/trend-chart";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { ResultStatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMyResults } from "@/lib/data/results";
import { formatDate, formatRange } from "@/lib/format";
import { resultStatus, valueClass } from "@/lib/results";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "A marker over time · The Schoeman Clinic" };

export default async function MarkerTrendPage({ params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const data = await getMyResults();
  const marker = data?.markers.find((m) => m.markerId === markerId);
  if (!marker) notFound();

  const rows = [...marker.points].reverse();
  return (
    <>
      <Link href="/portal/results" className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        All results
      </Link>
      <PageHeader
        eyebrow="My results"
        title={`${marker.name} `}
        accent="over time"
        description={`The clinic's range for this marker is ${formatRange(marker.refLow, marker.refHigh)}${marker.unit ? ` ${marker.unit}` : ""}.`}
      />
      <div className="max-w-3xl">
        <TrendChart points={marker.points} refLow={marker.refLow} refHigh={marker.refHigh} unit={marker.unit} name={marker.name} />
      </div>

      <SectionHeader title="Every " accent="value" className="mt-10 mb-3" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Taken</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((point, index) => {
            const status = resultStatus(point.flag);
            return (
              <TableRow key={`${point.date}-${index}`}>
                <TableCell>{formatDate(point.date)}</TableCell>
                <TableCell className={cn("tabular-nums", valueClass(status))}>
                  {point.value} {marker.unit ?? ""}
                </TableCell>
                <TableCell>{status ? <ResultStatusPill status={status} /> : null}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {marker.comments.length > 0 ? (
        <>
          <SectionHeader title="From your " accent="doctor" className="mt-10 mb-3" />
          <ul className="type-body flex flex-col gap-3">
            {marker.comments.map((comment) => (
              <li key={comment.date}>
                <span className="type-small text-content-muted">{formatDate(comment.date)}</span>
                <p>{comment.text}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
