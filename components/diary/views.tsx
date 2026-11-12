import Link from "next/link";

import { addDays, dayHeading, isoWeekday, londonParts } from "@/lib/calendar/time";
import type { DiaryClinician, DiaryEntry } from "@/lib/data/diary";
import { cn } from "@/lib/utils";

/** One colour per clinician, from the design tokens, so their bookings read at a glance. */
const SWATCHES = ["border-l-secondary", "border-l-status-info", "border-l-status-success", "border-l-status-warning", "border-l-primary", "border-l-content-muted"] as const;
export function swatchFor(staffId: string | null, clinicians: DiaryClinician[]): string {
  const index = clinicians.findIndex((c) => c.staffId === staffId);
  return index < 0 ? "border-l-surface-border" : SWATCHES[index % SWATCHES.length]!;
}

/** What a booking says to a screen reader and in its tooltip: everything the block may cut off. */
function describe(entry: DiaryEntry, clinicians: DiaryClinician[], withDay = false): string {
  const clinician = clinicians.find((c) => c.staffId === entry.clinicianId)?.name ?? "no clinician";
  const { day, time } = londonParts(entry.startsAt);
  return [
    `${withDay ? `${dayHeading(day)}, ` : ""}${time}`,
    entry.patientName,
    entry.type,
    `with ${clinician}`,
    entry.status === "no_show" ? "did not attend" : null,
    entry.newPatient ? "new patient, booked online" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** A row of the legend: each clinician's colour and name. */
export function DiaryLegend({ clinicians }: { clinicians: DiaryClinician[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Clinicians">
      {clinicians.map((c) => (
        <li key={c.staffId} className={cn("type-small border-l-4 pl-2", swatchFor(c.staffId, clinicians))}>
          {c.name}
        </li>
      ))}
    </ul>
  );
}

const HOUR_REM = 4;

function minutesOfDay(iso: string): number {
  const time = londonParts(iso).time ?? "00:00";
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

/** The hours to draw: 07:00 to 20:00, widened to fit any booking outside them. */
function hourRange(entries: DiaryEntry[]): [number, number] {
  let first = 7;
  let last = 20;
  for (const e of entries) {
    first = Math.min(first, Math.floor(minutesOfDay(e.startsAt) / 60));
    last = Math.max(last, Math.ceil((minutesOfDay(e.startsAt) + e.durationMin) / 60));
  }
  return [Math.max(0, first), Math.min(24, last)];
}

function entryHref(entry: DiaryEntry): string {
  return `/clinic/diary/${entry.id}?date=${londonParts(entry.startsAt).day}`;
}

/**
 * Bookings that overlap share the column side by side: each gets a lane, and every booking in a run
 * of overlaps is as wide as the widest run needs.
 */
function lanes(entries: DiaryEntry[]): Map<string, { lane: number; of: number }> {
  const sorted = [...entries].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const out = new Map<string, { lane: number; of: number }>();
  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const close = () => {
    const of = Math.max(1, laneEnds.length);
    for (const g of group) out.set(g.id, { lane: g.lane, of });
    group = [];
    laneEnds = [];
  };
  for (const e of sorted) {
    const start = Date.parse(e.startsAt);
    const end = Date.parse(e.endsAt);
    if (group.length && start >= groupEnd) close();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    group.push({ id: e.id, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return out;
}

function Booking({
  entry,
  clinicians,
  firstHour,
  showClinician,
  lane,
}: {
  entry: DiaryEntry;
  clinicians: DiaryClinician[];
  firstHour: number;
  showClinician: boolean;
  lane: { lane: number; of: number };
}) {
  const top = ((minutesOfDay(entry.startsAt) - firstHour * 60) / 60) * HOUR_REM;
  const height = Math.max((entry.durationMin / 60) * HOUR_REM, 1.5);
  const clinician = clinicians.find((c) => c.staffId === entry.clinicianId);
  const time = londonParts(entry.startsAt).time;
  const short = height < 2.75;
  const label = describe(entry, clinicians, showClinician);
  return (
    <Link
      href={entryHref(entry)}
      aria-label={label}
      title={label}
      className={cn(
        "absolute overflow-hidden border border-l-4 border-surface-border bg-surface-raised px-2 py-1 text-content no-underline hover:border-secondary-border",
        swatchFor(entry.clinicianId, clinicians),
        entry.status === "no_show" && "opacity-60",
      )}
      style={{ top: `${top}rem`, height: `${height}rem`, left: `calc(${(lane.lane / lane.of) * 100}% + 0.125rem)`, width: `calc(${100 / lane.of}% - 0.25rem)` }}
    >
      <span className="type-small block truncate font-medium">
        <span className="tabular-nums">{time}</span> {entry.patientName}
        {entry.status === "no_show" ? " · did not attend" : ""}
        {short ? <span className="font-normal text-content-muted"> · {entry.type}</span> : null}
      </span>
      <span className={cn("type-small block truncate text-content-muted", short && "sr-only")}>
        {entry.type}
        {showClinician && clinician ? ` · ${clinician.name}` : ""}
        {entry.newPatient ? " · new, booked online" : ""}
      </span>
    </Link>
  );
}

function HourLabels({ firstHour, lastHour }: { firstHour: number; lastHour: number }) {
  return (
    <div className="relative w-12 shrink-0" style={{ height: `${(lastHour - firstHour) * HOUR_REM}rem` }} aria-hidden>
      {Array.from({ length: lastHour - firstHour }, (_, i) => (
        <span key={i} className="type-small absolute right-2 -translate-y-1/2 text-content-muted tabular-nums" style={{ top: `${i * HOUR_REM}rem` }}>
          {i === 0 ? "" : `${String(firstHour + i).padStart(2, "0")}:00`}
        </span>
      ))}
    </div>
  );
}

function Column({ label, entries, clinicians, firstHour, lastHour, showClinician }: { label: React.ReactNode; entries: DiaryEntry[]; clinicians: DiaryClinician[]; firstHour: number; lastHour: number; showClinician: boolean }) {
  const placed = lanes(entries);
  return (
    <div className="flex min-w-40 flex-1 flex-col">
      <div className="type-small sticky top-0 z-10 border-b border-surface-border bg-surface px-2 py-2 font-medium">{label}</div>
      <div className="relative border-l border-surface-border" style={{ height: `${(lastHour - firstHour) * HOUR_REM}rem` }}>
        {Array.from({ length: lastHour - firstHour }, (_, i) => (
          <div key={i} className="absolute inset-x-0 border-t border-surface-border" style={{ top: `${i * HOUR_REM}rem` }} aria-hidden />
        ))}
        <ol className="contents">
          {entries.map((entry) => (
            <li key={entry.id} className="contents">
              <Booking entry={entry} clinicians={clinicians} firstHour={firstHour} showClinician={showClinician} lane={placed.get(entry.id) ?? { lane: 0, of: 1 }} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** One day: a column for each clinician, as in Semble. */
export function DayView({ entries, clinicians }: { entries: DiaryEntry[]; clinicians: DiaryClinician[] }) {
  const [firstHour, lastHour] = hourRange(entries);
  return (
    <div className="flex overflow-x-auto border border-surface-border bg-surface">
      <div className="flex flex-col">
        <div className="type-small border-b border-surface-border py-2" aria-hidden>
          &nbsp;
        </div>
        <HourLabels firstHour={firstHour} lastHour={lastHour} />
      </div>
      {clinicians.map((c) => (
        <Column
          key={c.staffId}
          label={<span className={cn("border-l-4 pl-2", swatchFor(c.staffId, clinicians))}>{c.name}</span>}
          entries={entries.filter((e) => e.clinicianId === c.staffId)}
          clinicians={clinicians}
          firstHour={firstHour}
          lastHour={lastHour}
          showClinician={false}
        />
      ))}
    </div>
  );
}

/** A week: a column for each day, with every clinician shown or only the one chosen. */
export function WeekView({ monday, entries, clinicians, showClinician }: { monday: string; entries: DiaryEntry[]; clinicians: DiaryClinician[]; showClinician: boolean }) {
  const [firstHour, lastHour] = hourRange(entries);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="flex overflow-x-auto border border-surface-border bg-surface">
      <div className="flex flex-col">
        <div className="type-small border-b border-surface-border py-2" aria-hidden>
          &nbsp;
        </div>
        <HourLabels firstHour={firstHour} lastHour={lastHour} />
      </div>
      {days.map((day) => (
        <Column
          key={day}
          label={
            <Link href={`/clinic/diary?view=day&date=${day}`} className="text-content no-underline hover:underline">
              {dayHeading(day).replace(/ [A-Za-z]+$/, "")}
            </Link>
          }
          entries={entries.filter((e) => londonParts(e.startsAt).day === day)}
          clinicians={clinicians}
          firstHour={firstHour}
          lastHour={lastHour}
          showClinician={showClinician}
        />
      ))}
    </div>
  );
}

/** A month: each day with its first bookings, and how many more. */
export function MonthView({ month, entries, clinicians, today, query }: { month: string; entries: DiaryEntry[]; clinicians: DiaryClinician[]; today: string; query: string }) {
  const first = `${month}-01`;
  const start = addDays(first, -(isoWeekday(first) - 1));
  const weeks: string[][] = [];
  for (let day = start; weeks.length < 6; ) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(day, i));
    if (weeks.length > 3 && week[0]!.slice(0, 7) !== month) break;
    weeks.push(week);
    day = addDays(day, 7);
  }
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-3xl table-fixed border-collapse border border-surface-border bg-surface">
      <thead>
        <tr>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <th key={d} scope="col" className="type-eyebrow border-b border-surface-border px-2 py-2 text-left text-content-muted">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((day) => {
              const list = entries.filter((e) => londonParts(e.startsAt).day === day);
              const inMonth = day.slice(0, 7) === month;
              return (
                <td key={day} className={cn("h-28 border border-surface-border p-1.5 align-top", !inMonth && "bg-surface-sunken")}>
                  <Link
                    href={`/clinic/diary?view=day&date=${day}${query}`}
                    aria-current={day === today ? "date" : undefined}
                    className={cn("type-small mb-1 inline-block px-1 tabular-nums no-underline", day === today ? "bg-primary font-medium text-primary-content" : "text-content-muted")}
                    aria-label={`${dayHeading(day)}: ${list.length} ${list.length === 1 ? "booking" : "bookings"}`}
                  >
                    {Number(day.slice(8))}
                  </Link>
                  <ul className="flex flex-col gap-0.5">
                    {list.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={entryHref(e)}
                          aria-label={describe(e, clinicians, true)}
                          title={describe(e, clinicians, true)}
                          className={cn("type-small block truncate border-l-4 pl-1 text-content no-underline hover:underline", swatchFor(e.clinicianId, clinicians))}
                        >
                          <span className="tabular-nums">{londonParts(e.startsAt).time}</span> {e.patientName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {list.length > 3 ? (
                    <Link href={`/clinic/diary?view=day&date=${day}${query}`} className="type-small text-content-muted">
                      and {list.length - 3} more
                    </Link>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
