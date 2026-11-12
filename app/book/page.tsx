import Link from "next/link";
import { Clock, MapPin, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getOnlineClinicians, getOnlineSlots, getOnlineTypes } from "@/lib/booking/online";
import { dayHeading, londonParts } from "@/lib/calendar/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Public booking for new patients, in three steps on one page: the appointment, the clinician (or
 * any), then a free time. The details come on the next page.
 */
export default async function BookPage({ searchParams }: { searchParams: Promise<{ type?: string; staff?: string }> }) {
  const query = await searchParams;
  const [types, clinicians] = await Promise.all([getOnlineTypes(), getOnlineClinicians()]);
  const type = types.find((t) => t.id === query.type) ?? (types.length === 1 ? types[0] : undefined);
  const staff = query.staff === "any" ? "any" : clinicians.find((c) => c.staffId === query.staff)?.staffId;
  const chosen = staff === "any" ? clinicians : clinicians.filter((c) => c.staffId === staff);
  const days = type && staff && chosen.length ? await getOnlineSlots(type, chosen) : null;
  const nameOf = new Map(clinicians.map((c) => [c.staffId, c.name]));

  if (types.length === 0 || clinicians.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Book an appointment" title="Online booking is not " accent="open yet" />
        <EmptyState>Please call or email the clinic to book.</EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Book an appointment" title="Book your " accent="appointment" description="Choose the appointment, who you would like to see and a time that suits you." />

      <section aria-labelledby="step-type" className="mb-10 flex flex-col gap-4">
        <h2 id="step-type" className="type-card-title">
          1. Appointment
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {types.map((t) => (
            <li key={t.id}>
              <Link href={`/book?type=${t.id}${staff ? `&staff=${staff}` : ""}#step-staff`} aria-current={t.id === type?.id ? "true" : undefined} className="block h-full text-content no-underline">
                <Card className={cn("h-full gap-2 hover:border-secondary-border", t.id === type?.id && "border-secondary-border bg-surface-selected")}>
                  <span className="type-body font-medium">{t.name}</span>
                  <span className="type-small flex items-center gap-3 text-content-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-4" aria-hidden />
                      {t.durationMin} minutes
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {t.locationKind === "video" ? <Video className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                      {t.locationKind === "video" ? "By video" : "In clinic"}
                    </span>
                  </span>
                  {t.description ? <span className="type-small text-content-muted">{t.description}</span> : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {type ? (
        <section id="step-staff" aria-labelledby="step-staff-title" className="mb-10 flex scroll-mt-6 flex-col gap-4">
          <h2 id="step-staff-title" className="type-card-title">
            2. Who you would like to see
          </h2>
          <ul className="flex flex-wrap gap-2">
            {[{ staffId: "any", name: "First available", jobTitle: "Any of our clinicians" }, ...clinicians].map((c) => (
              <li key={c.staffId}>
                <Link
                  href={`/book?type=${type.id}&staff=${c.staffId}#step-time`}
                  aria-current={c.staffId === staff ? "true" : undefined}
                  className={cn("flex flex-col border px-4 py-2.5 text-content no-underline hover:border-secondary-border", c.staffId === staff ? "border-secondary-border bg-surface-selected" : "border-surface-border bg-surface-raised")}
                >
                  <span className="type-body font-medium">{c.name}</span>
                  <span className="type-small text-content-muted">{c.jobTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {type && days ? (
        <section id="step-time" aria-labelledby="step-time-title" className="flex scroll-mt-6 flex-col gap-4">
          <h2 id="step-time-title" className="type-card-title">
            3. Time
          </h2>
          {days.every((d) => d.slots.length === 0) ? (
            <EmptyState>No times are free in the next three weeks. Please choose another clinician, or call the clinic.</EmptyState>
          ) : (
            <div className="flex flex-col gap-5">
              {days
                .filter((d) => d.slots.length > 0)
                .map((d) => (
                  <div key={d.day} className="flex flex-col gap-2">
                    <h3 className="type-body font-medium">{dayHeading(d.day)}</h3>
                    <ul className="flex flex-wrap gap-2">
                      {d.slots.map((slot) => {
                        const time = londonParts(slot.startsAt).time;
                        const href = `/book/details?${new URLSearchParams({ type: type.id, staff: slot.staffId, starts: slot.startsAt, ...(slot.locationId ? { location: slot.locationId } : {}) }).toString()}`;
                        return (
                          <li key={slot.startsAt}>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={href} aria-label={`${time}, ${dayHeading(d.day)}${staff === "any" ? `, with ${nameOf.get(slot.staffId)}` : ""}`}>
                                <span className="tabular-nums">{time}</span>
                              </Link>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
