const TIME_ZONE = "Europe/London";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parts(value: Date | string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  // A date column has no time zone: read it as that calendar day, wherever we are.
  const isDateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const date = isDateOnly ? new Date(`${value}T12:00:00Z`) : new Date(value);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: isDateOnly ? "UTC" : TIME_ZONE,
  }).formatToParts(date);
  return Object.fromEntries(formatted.map((part) => [part.type, part.value]));
}

/** 29 Oct 2026 */
export function formatDate(value: Date | string): string {
  const p = parts(value, { day: "numeric", month: "short", year: "numeric" });
  return `${p.day} ${p.month.replace("Sept", "Sep")} ${p.year}`;
}

/** Wed 18 Nov 2026 */
export function formatDayDate(value: Date | string): string {
  const p = parts(value, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${p.weekday} ${p.day} ${p.month.replace("Sept", "Sep")} ${p.year}`;
}

/** Thursday 29 October 2026 */
export function formatLongDate(value: Date | string): string {
  const p = parts(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** 10:30 */
export function formatTime(value: Date | string): string {
  const p = parts(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** £295.00 */
export function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

/** 20–41, < 5, > 1.2, or that the range varies. */
export function formatRange(low: number | null, high: number | null): string {
  if (low !== null && high !== null) return `${low}–${high}`;
  if (high !== null) return `< ${high}`;
  if (low !== null) return `> ${low}`;
  return "Varies by cycle";
}

/** The calendar date in London, as YYYY-MM-DD. */
export function londonDate(value: Date = new Date()): string {
  const p = parts(value, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** The moment a London calendar day begins. */
export function londonDayStart(date: string): Date {
  const noon = new Date(`${date}T12:00:00Z`);
  const p = parts(noon, { hour: "2-digit", hourCycle: "h23" });
  const offsetHours = Number(p.hour) - 12;
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetHours * 3_600_000);
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(parts(now, { hour: "2-digit", hourCycle: "h23" }).hour);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Dr Gina Schoeman" becomes "Dr Schoeman"; anyone else goes by their first name. */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  if (words[0] === "Dr" && words.length > 1) return `Dr ${words[words.length - 1]}`;
  return words[0] ?? "";
}

export function initials(fullName: string): string {
  return fullName
    .replace(/^Dr\s+/, "")
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
