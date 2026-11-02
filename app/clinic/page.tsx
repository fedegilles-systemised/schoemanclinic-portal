import type { Metadata } from "next";
import { ArrowDown, ArrowRight, ArrowUp, Clock, MapPin, TriangleAlert, Video } from "lucide-react";

import { ComingSoon } from "@/components/shell/coming-soon";
import { Button } from "@/components/ui/button";
import { Card, CardActions, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ResultStatusPill, StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getClinicHome, type RiskCard } from "@/lib/data/clinic";
import { getLocations } from "@/lib/data/shell";
import {
  formatDate,
  formatDayDate,
  formatLongDate,
  formatRange,
  formatTime,
  greeting,
  greetingName,
  londonDate,
} from "@/lib/format";
import { resultStatus, valueClass } from "@/lib/results";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard · The Schoeman Clinic" };

const ORDER_LABELS = {
  sent_to_patient: "Awaiting payment",
  paid: "Paid, no sample",
  sample_taken: "Sample taken",
  results_in: "Results in",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
} as const;

function dueLabel(days: number | null): { label: string; overdue: boolean } {
  if (days === null) return { label: "No due date", overdue: false };
  if (days < 0) return { label: `Overdue by ${-days} ${days === -1 ? "day" : "days"}`, overdue: true };
  if (days === 0) return { label: "Due today", overdue: true };
  return { label: `${days} ${days === 1 ? "day" : "days"} left`, overdue: false };
}

function appointmentLabel(startsAt: string): string {
  return londonDate(new Date(startsAt)) === londonDate()
    ? `Today, ${formatTime(startsAt)}`
    : `${formatDayDate(startsAt)}, ${formatTime(startsAt)}`;
}

function Risk({ risk }: { risk: RiskCard }) {
  const due = dueLabel(risk.daysToDue);
  return (
    <Card>
      <div className="flex justify-between gap-2">
        <CardTitle>{risk.patientName}</CardTitle>
        <StatusPill
          tone={due.overdue ? "danger" : "warning"}
          icon={due.overdue ? TriangleAlert : Clock}
          label={due.label}
          className="shrink-0"
        />
      </div>
      <dl className="type-table grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-content-muted">Appointment</dt>
        <dd>{appointmentLabel(risk.startsAt)}</dd>
        <dt className="text-content-muted">Order</dt>
        <dd>
          {risk.orderStatus === "sample_taken" && risk.sampleTakenAt
            ? `Sample taken ${formatDate(risk.sampleTakenAt)}`
            : ORDER_LABELS[risk.orderStatus]}
        </dd>
      </dl>
      <CardActions>
        <ComingSoon>
          <Button variant="outline-bronze" size="sm" disabled>
            Send chaser
          </Button>
        </ComingSoon>
        <ComingSoon>
          <Button variant="ghost" disabled>
            Move appointment
          </Button>
        </ComingSoon>
      </CardActions>
    </Card>
  );
}

export default async function ClinicHomePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;
  const [user, locations] = await Promise.all([getCurrentUser(), getLocations()]);
  const selected = locations.find((item) => item.id === location) ?? null;
  const home = await getClinicHome(selected?.id ?? null);

  return (
    <>
      <PageHeader
        eyebrow={`${formatLongDate(new Date())} · ${selected?.name ?? "All locations"}`}
        title={`${greeting()}, `}
        accent={greetingName(user?.fullName ?? "")}
      />

      <div className="grid grid-cols-1 gap-6 phone:grid-cols-2 min-[1100px]:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={home.todayCount}
          context={
            home.nextToday
              ? `Next at ${formatTime(home.nextToday.startsAt)} · ${home.nextToday.patientName}`
              : "None still to come today"
          }
        />
        <StatCard
          label="Results to review"
          value={home.toReviewCount}
          urgent={home.toReviewOutOfRange > 0}
          context={`${home.toReviewOutOfRange} with out-of-range values`}
        />
        <StatCard label="Imports waiting" value={home.importsWaiting} context="Uploaded and emailed reports" />
        <StatCard label="Open tasks" value="—" context="In GoHighLevel" />
      </div>

      <section className="mt-12 flex flex-col gap-4">
        <SectionHeader title="Needs your " accent="attention">
          <ComingSoon>
            <Button variant="ghost" disabled>
              Open review queue <ArrowRight aria-hidden className="size-3.5" />
            </Button>
          </ComingSoon>
        </SectionHeader>
        {home.attention.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Marker</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {home.attention.map((row) => {
                const status = resultStatus(row.flag);
                const numeric = typeof row.value === "number" ? row.value : null;
                const change = numeric !== null && row.previous !== null ? numeric - row.previous : null;
                return (
                  <TableRow key={row.reportId}>
                    <TableCell>
                      <span className="font-medium">{row.patientName}</span>
                      <span className="type-small block text-content-muted">{row.panelName}</span>
                    </TableCell>
                    <TableCell>{row.markerName}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={cn("type-value", valueClass(status))}>{row.value}</span>{" "}
                      <span className="type-small text-content-muted">{row.unit}</span>
                    </TableCell>
                    <TableCell className="type-small text-content-muted tabular-nums">
                      {formatRange(row.refLow, row.refHigh)}
                    </TableCell>
                    <TableCell className="type-small whitespace-nowrap text-content-muted tabular-nums">
                      {change === null ? (
                        "No previous"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {change > 0 ? <ArrowUp aria-hidden className="size-3" /> : null}
                          {change < 0 ? <ArrowDown aria-hidden className="size-3" /> : null}
                          {change > 0 ? "+" : ""}
                          {Number(change.toFixed(2))} from {row.previous}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{status ? <ResultStatusPill status={status} /> : null}</TableCell>
                    <TableCell className="type-small whitespace-nowrap text-content-muted">
                      {formatDate(row.receivedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ComingSoon>
                        <Button variant="outline" size="sm" disabled>
                          Review
                        </Button>
                      </ComingSoon>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState>Reports waiting for a doctor&apos;s review will appear here.</EmptyState>
        )}
      </section>

      <section id="diary" className="mt-12 flex flex-col gap-4">
        <SectionHeader title="Today's " accent="diary">
          <span className="type-small text-content-muted">{selected?.name ?? "All locations"}</span>
        </SectionHeader>
        {home.diary.length ? (
          <Table>
            <TableBody>
              {home.diary.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="w-18 font-semibold tabular-nums">{formatTime(row.startsAt)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{row.patientName}</span>
                    <span className="type-small block text-content-muted">{row.clinicRef}</span>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      tone={row.type === "Initial assessment" ? "dark" : "neutral"}
                      icon={Clock}
                      label={row.type}
                    />
                  </TableCell>
                  <TableCell className="type-small whitespace-nowrap text-content-muted">{row.durationMin} min</TableCell>
                  <TableCell className="type-small whitespace-nowrap text-content-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {row.locationKind === "video" ? (
                        <Video aria-hidden className="size-3.5" />
                      ) : (
                        <MapPin aria-hidden className="size-3.5" />
                      )}
                      {row.locationName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.flag === "bloods_missing" ? (
                      <StatusPill tone="danger" icon={TriangleAlert} label="Bloods missing" />
                    ) : row.flag === "result_to_review" ? (
                      <StatusPill tone="warning" icon={Clock} label="Result to review" />
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <ComingSoon>
                      <Button variant="ghost" disabled>
                        Open record
                      </Button>
                    </ComingSoon>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState>Appointments at this location today will appear here.</EmptyState>
        )}
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <SectionHeader title="Bloods " accent="at risk">
          <span className="type-small text-content-muted">Appointments in the next 14 days without results</span>
        </SectionHeader>
        {home.risks.length ? (
          <div className="grid gap-6 shell:grid-cols-3">
            {home.risks.map((risk) => (
              <Risk key={risk.appointmentId} risk={risk} />
            ))}
          </div>
        ) : (
          <EmptyState>Appointments that are missing results will appear here.</EmptyState>
        )}
      </section>
    </>
  );
}
