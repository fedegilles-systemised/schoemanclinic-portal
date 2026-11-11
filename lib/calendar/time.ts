/**
 * Dates for the staff Calendar screen, always in the clinic's time zone (Europe/London),
 * whatever time zone the server runs in. Days are `YYYY-MM-DD` strings throughout.
 */

const TIME_ZONE = "Europe/London";
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parts(instant: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
    timeZoneName: "longOffset",
  });
  return Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
}

/** Today in London. */
export function todayInLondon(now = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isDay(value: string | undefined): value is string {
  if (!value || !DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week that holds `day`. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** London's offset from UTC at that wall-clock time, as `+01:00`. Handles the clock change. */
function offsetAt(day: string, time: string): string {
  // Ask about the instant as if it were UTC, then once more with the offset found, so a time
  // just after the clock change gets the right answer.
  let offset = parts(new Date(`${day}T${time}:00Z`)).timeZoneName.replace("GMT", "") || "+00:00";
  offset = parts(new Date(`${day}T${time}:00${offset}`)).timeZoneName.replace("GMT", "") || "+00:00";
  return offset;
}

/** Midnight in London on that day, as an instant Google accepts (RFC 3339). */
export function startOfDayInstant(day: string): string {
  return `${day}T00:00:00${offsetAt(day, "00:00")}`;
}

/** The London day and time of an event's start or end. All-day events have no time. */
export function londonParts(value: string): { day: string; time: string | null } {
  if (DAY_PATTERN.test(value)) return { day: value, time: null };
  const p = parts(new Date(value));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "Monday 17 November". */
export function dayHeading(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/** "17 to 23 November 2026", or across months "28 December 2026 to 3 January 2027". */
export function weekHeading(monday: string): string {
  const sunday = addDays(monday, 6);
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  if (monday.slice(0, 7) === sunday.slice(0, 7)) {
    return `${format(monday, { day: "numeric" })} to ${format(sunday, { day: "numeric", month: "long", year: "numeric" })}`;
  }
  return `${format(monday, { day: "numeric", month: "long", year: "numeric" })} to ${format(sunday, { day: "numeric", month: "long", year: "numeric" })}`;
}
