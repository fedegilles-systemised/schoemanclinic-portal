import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { DayView, DiaryLegend, MonthView, WeekView } from "@/components/diary/views";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth/session";
import { addDays, dayHeading, isDay, londonInstant, mondayOf, todayInLondon, weekHeading } from "@/lib/calendar/time";
import { getDiary, getDiaryPeople } from "@/lib/data/diary";
import { getMyStaffId } from "@/lib/data/patient-record";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Diary · Clinic Hub" };

type View = "day" | "week" | "month";

function monthHeading(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + by, 15));
  return date.toISOString().slice(0, 7);
}

/**
 * The clinic diary: bookings by day, week or month, as in Semble. Admins and PAs see every
 * clinician's; a doctor, nurse or health coach sees their own. Opening a record follows the care team.
 */
export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; staff?: string; location?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuspended || !user.isStaff) redirect("/clinic");
  const query = await searchParams;
  const view: View = query.view === "week" || query.view === "month" ? query.view : "day";
  const today = todayInLondon();
  const date = isDay(query.date) ? query.date : today;

  const [{ clinicians, locations }, myStaffId] = await Promise.all([getDiaryPeople(), getMyStaffId(user.id)]);
  const mine = clinicians.find((c) => c.staffId === myStaffId);
  // Admins and PAs see every clinician's diary; a doctor, nurse or health coach sees only their own
  // (the clinic's decision of 12 November 2026; the database applies it too).
  const seesAll = user.roles.some((r) => r === "admin" || r === "pa");
  const staff = !seesAll
    ? (mine?.staffId ?? "none")
    : query.staff === "all"
      ? "all"
      : clinicians.some((c) => c.staffId === query.staff)
        ? query.staff!
        : "all";
  const location = locations.some((l) => l.id === query.location) ? query.location! : "all";

  const month = date.slice(0, 7);
  const [fromDay, toDay] =
    view === "day" ? [date, addDays(date, 1)] : view === "week" ? [mondayOf(date), addDays(mondayOf(date), 7)] : [mondayOf(`${month}-01`), addDays(mondayOf(`${month}-01`), 42)];
  const all = await getDiary(londonInstant(fromDay, "00:00"), londonInstant(toDay, "00:00"));
  const entries = all.filter((e) => (staff === "all" || e.clinicianId === staff) && (location === "all" || e.locationId === location || e.locationId === null));
  const shown = staff === "all" ? clinicians : clinicians.filter((c) => c.staffId === staff);
  const legend = seesAll ? clinicians : shown;

  const step = (by: number) => (view === "day" ? addDays(date, by) : view === "week" ? addDays(date, 7 * by) : `${shiftMonth(month, by)}-01`);
  const params = (changes: Record<string, string>) => {
    const next = new URLSearchParams({ view, date, staff, location, ...changes });
    return `/clinic/diary?${next.toString()}`;
  };
  const heading = view === "day" ? dayHeading(date) : view === "week" ? weekHeading(mondayOf(date)) : monthHeading(month);
  const extra = `${staff !== "all" ? `&staff=${staff}` : ""}${location !== "all" ? `&location=${location}` : ""}`;

  return (
    <>
      <PageHeader eyebrow="Diary" title={`${heading} `} description={`${entries.length} ${entries.length === 1 ? "booking" : "bookings"}${staff !== "all" ? ` for ${shown[0]?.name ?? "one clinician"}` : ""}.`}>
        <Button size="sm" asChild>
          <Link href="/clinic/diary/book">
            <Plus aria-hidden />
            New booking
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Diary view" className="flex items-center gap-1">
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={params({ view: v })}
              aria-current={v === view ? "page" : undefined}
              className={cn("type-button-label border px-3 py-2 no-underline", v === view ? "border-primary bg-primary text-primary-content" : "border-surface-border text-content hover:border-secondary-border")}
            >
              {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
            </Link>
          ))}
          <span className="mx-2 h-6 w-px bg-surface-border" aria-hidden />
          <Link href={params({ date: step(-1) })} className="flex size-control-sm items-center justify-center text-content hover:bg-surface-selected" aria-label={`Previous ${view}`}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={params({ date: today })} className="type-button-label px-3 py-2 text-content no-underline hover:bg-surface-selected">
            Today
          </Link>
          <Link href={params({ date: step(1) })} className="flex size-control-sm items-center justify-center text-content hover:bg-surface-selected" aria-label={`Next ${view}`}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </nav>

        <form method="get" action="/clinic/diary" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={date} />
          {seesAll ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="diary-staff">Clinician</Label>
              <Select id="diary-staff" name="staff" defaultValue={staff}>
                <option value="all">All clinicians</option>
                {clinicians.map((c) => (
                  <option key={c.staffId} value={c.staffId}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="diary-location">Location</Label>
            <Select id="diary-location" name="location" defaultValue={location}>
              <option value="all">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline" size="sm">
            Show
          </Button>
        </form>
      </div>

      {!seesAll && !mine ? (
        <EmptyState>The diary shows your own bookings. You have none, as you are not a clinician who can be booked.</EmptyState>
      ) : clinicians.length === 0 ? (
        <EmptyState>No clinicians yet. Add their hours in Booking settings.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {staff === "all" && view !== "day" ? <DiaryLegend clinicians={clinicians} /> : null}
          {view === "day" ? (
            <DayView entries={entries} clinicians={shown} />
          ) : view === "week" ? (
            <WeekView monday={mondayOf(date)} entries={entries} clinicians={legend} showClinician={staff === "all"} />
          ) : (
            <MonthView month={month} entries={entries} clinicians={legend} today={today} query={extra} />
          )}
        </div>
      )}
    </>
  );
}
