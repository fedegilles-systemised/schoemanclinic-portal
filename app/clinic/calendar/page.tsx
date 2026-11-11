import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ExternalLink } from "lucide-react";

import { DeleteEventDialog, DisconnectForm, EventDialog, type EventDraft } from "@/components/calendar/event-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardActions, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { disconnect, GoogleDisconnectedError, googleSessionFor, listEvents, type CalendarEvent } from "@/lib/calendar/google";
import {
  addDays,
  dayHeading,
  isDay,
  londonParts,
  mondayOf,
  startOfDayInstant,
  todayInLondon,
  weekHeading,
} from "@/lib/calendar/time";
import { isGoogleConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar · The Schoeman Clinic" };

const ERRORS: Record<string, string> = {
  cancelled: "Google Calendar was not connected. You can try again at any time.",
  expired: "That connection attempt timed out. Please start again.",
  revoked: "Google no longer allows Clinic Hub to use your calendar, so it has been disconnected. Connect it again to carry on.",
  "no-calendar": "Clinic Hub needs access to your calendar events. Please connect again and leave the calendar box ticked.",
  "not-set-up": "Google Calendar is not set up for the clinic yet.",
  "wrong-account": "Connect the Google account you use for the clinic. Personal Google accounts cannot be connected.",
  failed: "We could not connect your Google Calendar. Please try again.",
};

type LoadResult =
  | { kind: "events"; events: CalendarEvent[] }
  | { kind: "reconnect" }
  | { kind: "failed" };

async function loadWeek(userId: string, monday: string): Promise<LoadResult> {
  try {
    const session = await googleSessionFor(userId);
    if (!session) return { kind: "reconnect" };
    const events = await listEvents(session, startOfDayInstant(monday), startOfDayInstant(addDays(monday, 7)));
    return { kind: "events", events };
  } catch (error) {
    if (error instanceof GoogleDisconnectedError) {
      await disconnect(userId).catch(() => undefined);
      return { kind: "reconnect" };
    }
    console.error(`Calendar could not be loaded: ${error instanceof Error ? error.message : "unknown"}`);
    return { kind: "failed" };
  }
}

/** Only same-day timed events are edited here; the form has one date. Others are edited in Google. */
function editableHere(event: CalendarEvent): boolean {
  return !event.allDay && londonParts(event.start).day === londonParts(event.end).day;
}

/** The days of the week an event appears on: an all-day event spans its days, a timed one its start day. */
function daysOf(event: CalendarEvent): string[] {
  const start = londonParts(event.start).day;
  if (!event.allDay) return [start];
  const days: string[] = [];
  // Google's all-day end date is the day after the last day.
  for (let day = start; day < event.end && days.length < 62; day = addDays(day, 1)) days.push(day);
  return days;
}

function draftFor(event: CalendarEvent): EventDraft {
  const start = londonParts(event.start);
  const end = londonParts(event.end);
  return {
    id: event.id,
    title: event.title,
    day: start.day,
    startTime: start.time ?? "09:00",
    endTime: end.time ?? "10:00",
    repeating: event.repeating,
    location: event.location,
    description: event.description,
  };
}

function timeLabel(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const start = londonParts(event.start);
  const end = londonParts(event.end);
  return `${start.time} to ${end.time}${end.day !== start.day ? ` (${dayHeading(end.day)})` : ""}`;
}

function Notice({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <Alert variant={tone}>
        {tone === "success" ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    </div>
  );
}

/** Every team member's own Google Calendar: see the week, add, change and delete events. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; connected?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");

  const params = await searchParams;
  const banner = params.connected
    ? { tone: "success" as const, text: "Your Google Calendar is connected." }
    : params.error
      ? { tone: "danger" as const, text: ERRORS[params.error] ?? ERRORS.failed }
      : null;

  if (!isGoogleConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Calendar" title="Your " accent="calendar" />
        <EmptyState>Google Calendar is not set up for the clinic yet. The Google keys need adding to the site.</EmptyState>
      </>
    );
  }

  // Read through the person's own session: row-level security returns their row only.
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("google_email, connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return (
      <>
        <PageHeader eyebrow="Calendar" title="Your " accent="calendar" />
        {banner ? <Notice tone={banner.tone}>{banner.text}</Notice> : null}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Connect your Google Calendar</CardTitle>
            <CardDescription>
              See your week here, and add, change or delete events. Everything you do here also appears in Google
              Calendar, and changes made in Google show here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="type-small text-content-muted">
              Google may show a screen saying it has not verified this app. Choose Advanced, then Go to Clinic Hub, to
              carry on. You can disconnect at any time.
            </p>
            <div>
              <Button asChild>
                <a href="/api/google/connect">
                  <CalendarDays aria-hidden />
                  Connect Google Calendar
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const today = todayInLondon();
  const monday = mondayOf(isDay(params.week) ? params.week : today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const result = await loadWeek(user.id, monday);
  if (result.kind === "reconnect") redirect("/clinic/calendar?error=revoked");

  const byDay = new Map<string, CalendarEvent[]>(days.map((day) => [day, []]));
  if (result.kind === "events") {
    for (const event of result.events) {
      for (const day of daysOf(event)) byDay.get(day)?.push(event);
    }
  }
  const newDraft: EventDraft = {
    title: "",
    day: days.includes(today) ? today : monday,
    startTime: "09:00",
    endTime: "09:30",
    location: "",
    description: "",
  };

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Your "
        accent="calendar"
        description={`Synced with Google Calendar (${connection.google_email}). Times are London time.`}
      >
        <EventDialog draft={newDraft} />
      </PageHeader>
      {banner ? <Notice tone={banner.tone}>{banner.text}</Notice> : null}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <SectionHeader title={weekHeading(monday)} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/clinic/calendar?week=${addDays(monday, -7)}`}>
              <ChevronLeft aria-hidden />
              Previous week
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/clinic/calendar">This week</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/clinic/calendar?week=${addDays(monday, 7)}`}>
              Next week
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {result.kind === "failed" ? (
        <Notice tone="danger">We could not load your calendar from Google. Please refresh the page in a moment.</Notice>
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((day) => {
            const events = byDay.get(day) ?? [];
            return (
              <section key={day} aria-labelledby={`day-${day}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
                  <h3 id={`day-${day}`} className="type-section-title">
                    {dayHeading(day)}
                  </h3>
                  {day === today ? <Badge variant="outline">Today</Badge> : null}
                </div>
                {events.length === 0 ? (
                  <EmptyState>Nothing booked.</EmptyState>
                ) : (
                  <ul className="flex flex-col divide-y divide-surface-border border border-surface-border">
                    {events.map((event) => (
                      <li key={`${day}-${event.id}`} className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="type-small tabular-nums text-content-muted">{timeLabel(event)}</div>
                          <div className="type-body text-content">{event.title}</div>
                          {event.location ? <div className="type-small text-content-muted">{event.location}</div> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {editableHere(event) ? <EventDialog draft={draftFor(event)} /> : null}
                          <DeleteEventDialog id={event.id} title={event.title} />
                          {event.link ? (
                            <Button asChild variant="ghost" size="sm">
                              <a href={event.link} target="_blank" rel="noreferrer noopener">
                                <ExternalLink aria-hidden />
                                Open in Google
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Card className="mt-12 max-w-2xl">
        <CardHeader>
          <CardTitle>Google account</CardTitle>
          <CardDescription>
            Connected as {connection.google_email}. Disconnecting removes Clinic Hub&apos;s access to your calendar; your
            events stay in Google.
          </CardDescription>
        </CardHeader>
        <CardActions>
          <DisconnectForm />
        </CardActions>
      </Card>
    </>
  );
}
