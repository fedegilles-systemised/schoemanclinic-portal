import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import { ComingSoon } from "@/components/shell/coming-soon";
import { AlertBar } from "@/components/ui/alert-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardActions,
  CardDescription,
  CardEyebrow,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderSteps } from "@/components/ui/order-steps";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Sparkline } from "@/components/ui/sparkline";
import { ResultStatusPill } from "@/components/ui/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortalHome, type MarkerGlance } from "@/lib/data/portal";
import {
  formatDate,
  formatDayDate,
  formatLongDate,
  formatRange,
  formatTime,
  greeting,
} from "@/lib/format";
import { resultStatus, valueClass } from "@/lib/results";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home · The Schoeman Clinic" };

const ORDER_STEPS = ["Ordered", "Paid", "Sample taken", "Results in"];
const STEP_DONE = { sent_to_patient: 0, paid: 1, sample_taken: 2, results_in: 3, reviewed: 3, cancelled: -1 } as const;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function MarkerCard({ marker }: { marker: MarkerGlance }) {
  const status = resultStatus(marker.flag);
  const tone = status === "out_of_range" ? "danger" : status === "borderline" ? "warning" : "default";
  return (
    <Card>
      <CardEyebrow>{marker.name}</CardEyebrow>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className={cn("type-big-number", valueClass(status))}>{marker.latest}</span>{" "}
          {marker.unit ? <span className="type-small text-content-muted">{marker.unit}</span> : null}
        </div>
        <Sparkline values={marker.history} tone={tone} />
      </div>
      <p className="type-small text-content-muted tabular-nums">Range {formatRange(marker.refLow, marker.refHigh)}</p>
      {status ? <ResultStatusPill status={status} className="w-fit" /> : null}
    </Card>
  );
}

export default async function PortalHomePage() {
  const [user, home] = await Promise.all([getCurrentUser(), getPortalHome()]);
  const today = formatLongDate(new Date());

  if (!home) {
    return (
      <>
        <PageHeader eyebrow={today} title={`${greeting()}, `} accent={user?.fullName.split(" ")[0]} />
        <EmptyState>Your record will appear here once the clinic has set it up.</EmptyState>
      </>
    );
  }

  const { patient, appointment, bloods, latestReport, glance, letter, runningLow } = home;
  const greetName = patient.is_self ? patient.first_name : user?.fullName.split(" ")[0];
  // A guardian reads about the person they look after, not about themselves.
  const whose = patient.is_self ? "your" : `${patient.first_name}'s`;

  return (
    <>
      <PageHeader
        eyebrow={patient.is_self ? today : `${today} · Viewing ${patient.first_name} ${patient.last_name}`}
        title={`${greeting()}, `}
        accent={greetName}
      />

      {bloods?.dueBy ? (
        <AlertBar tone="warning" icon={CalendarDays} lead={`Bloods due by ${formatDate(bloods.dueBy)}.`} className="mb-6">
          Results need to reach us two weeks before {whose} appointment.
        </AlertBar>
      ) : null}

      <div className="grid gap-6 shell:grid-cols-3">
        {appointment ? (
          <Card>
            <CardEyebrow>Next appointment</CardEyebrow>
            <CardTitle>{appointment.type}</CardTitle>
            <CardMeta>
              <span>
                <CalendarDays aria-hidden />
                {formatDayDate(appointment.startsAt)}, {formatTime(appointment.startsAt)}
              </span>
              {appointment.locationName ? (
                <span>
                  <MapPin aria-hidden />
                  {appointment.locationName}
                </span>
              ) : null}
            </CardMeta>
            <CardDescription>
              {appointment.clinicianName ? `With ${appointment.clinicianName} · ` : ""}
              {appointment.durationMin} minutes
            </CardDescription>
            <CardActions>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/appointments">View details</Link>
              </Button>
            </CardActions>
          </Card>
        ) : (
          <EmptyState>Your next appointment will appear here.</EmptyState>
        )}

        {bloods ? (
          <Card>
            <CardEyebrow>{bloods.dueBy ? `Bloods due by ${formatDate(bloods.dueBy)}` : "Bloods"}</CardEyebrow>
            <CardTitle>{bloods.panelName}</CardTitle>
            <OrderSteps steps={ORDER_STEPS} doneThrough={STEP_DONE[bloods.status]} />
            <CardActions>
              <ComingSoon>
                {bloods.status === "sent_to_patient" ? (
                  <Button size="sm" disabled>
                    Pay and get barcode
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Download barcode form
                  </Button>
                )}
              </ComingSoon>
            </CardActions>
          </Card>
        ) : (
          <EmptyState>Any bloods your doctor orders will appear here.</EmptyState>
        )}

        {latestReport ? (
          <Card>
            <CardEyebrow>New results</CardEyebrow>
            <CardTitle>
              {latestReport.resultCount} {latestReport.resultCount === 1 ? "result" : "results"} released
            </CardTitle>
            <CardDescription>
              {latestReport.reviewerName ?? "The doctor"} reviewed {whose} bloods
              {latestReport.reviewedAt ? ` on ${formatDate(latestReport.reviewedAt)}` : ""}
              {latestReport.commentedMarkers.length
                ? ` and left comments on ${joinNames(latestReport.commentedMarkers)}.`
                : "."}
            </CardDescription>
            <CardActions>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/results">View results</Link>
              </Button>
            </CardActions>
          </Card>
        ) : (
          <EmptyState>Your results will appear here once your doctor has released them.</EmptyState>
        )}
      </div>

      <section className="mt-12 flex flex-col gap-4">
        <SectionHeader title="Your markers " accent="at a glance">
          <Button variant="ghost" asChild>
            <Link href="/portal/results">
              All results <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        </SectionHeader>
        {glance.length ? (
          <div className="grid grid-cols-1 gap-6 phone:grid-cols-2 min-[1100px]:grid-cols-4">
            {glance.map((marker) => (
              <MarkerCard key={marker.code} marker={marker} />
            ))}
          </div>
        ) : (
          <EmptyState>Your latest values will appear here once your doctor has released them.</EmptyState>
        )}
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <SectionHeader title="From your " accent="clinic" />
        <div className="grid gap-6 shell:grid-cols-2">
          {letter ? (
            <Card>
              <CardEyebrow>Latest letter · {formatDate(letter.createdAt)}</CardEyebrow>
              <CardTitle>{letter.title}</CardTitle>
              {letter.authorName ? <CardDescription>From {letter.authorName}</CardDescription> : null}
              <CardActions>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/portal/documents">View letter</Link>
                </Button>
              </CardActions>
            </Card>
          ) : (
            <EmptyState>Letters your doctor shares with you will appear here.</EmptyState>
          )}
          {runningLow ? (
            <Card>
              <CardEyebrow>Prescription</CardEyebrow>
              <CardTitle>{runningLow.name}</CardTitle>
              <CardDescription>
                <span className="font-medium text-status-warning">
                  {runningLow.daysLeft > 1 ? `${runningLow.daysLeft} days left.` : runningLow.daysLeft === 1 ? "1 day left." : "Your supply has run out."}
                </span>{" "}
                Request a repeat now so it arrives in time.
              </CardDescription>
              {patient.can_act ? (
                <CardActions>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/portal/prescriptions/new">Request a repeat</Link>
                  </Button>
                </CardActions>
              ) : null}
            </Card>
          ) : (
            <EmptyState>We will tell you here when a prescription is running low.</EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
