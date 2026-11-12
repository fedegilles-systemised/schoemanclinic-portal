import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, UserRound } from "lucide-react";
import { z } from "zod";

import { OnlineBookingForm } from "@/components/booking/online-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getOnlineClinicians, getOnlineTypes } from "@/lib/booking/online";
import { dayHeading, londonParts } from "@/lib/calendar/time";

export const dynamic = "force-dynamic";

/** The chosen appointment, and the new patient's details to book it. The time is checked again on booking. */
export default async function BookDetailsPage({ searchParams }: { searchParams: Promise<{ type?: string; staff?: string; starts?: string; location?: string }> }) {
  const query = await searchParams;
  const starts = z.iso.datetime({ offset: true }).safeParse(query.starts);
  const location = z.uuid().safeParse(query.location);
  const [types, clinicians] = await Promise.all([getOnlineTypes(), getOnlineClinicians()]);
  const type = types.find((t) => t.id === query.type);
  const clinician = clinicians.find((c) => c.staffId === query.staff);
  if (!type || !clinician || !starts.success) notFound();
  const { day, time } = londonParts(starts.data);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <Link href={`/book?type=${type.id}&staff=${clinician.staffId}`} className="type-small mb-4 inline-flex items-center gap-1.5 text-content-muted no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        Choose another time
      </Link>
      <PageHeader eyebrow="Book an appointment" title="Your " accent="details" />
      <Card className="mb-8">
        <CardContent className="flex flex-col gap-2">
          <p className="type-body font-medium">{type.name}</p>
          <p className="type-body flex items-center gap-2">
            <CalendarDays className="size-4 text-content-muted" aria-hidden />
            {dayHeading(day)}
          </p>
          <p className="type-body flex items-center gap-2 tabular-nums">
            <Clock className="size-4 text-content-muted" aria-hidden />
            {time}, {type.durationMin} minutes, {type.locationKind === "video" ? "by video" : "in clinic"}
          </p>
          <p className="type-body flex items-center gap-2">
            <UserRound className="size-4 text-content-muted" aria-hidden />
            {clinician.name}
          </p>
        </CardContent>
      </Card>
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} async defer /> : null}
      <OnlineBookingForm typeId={type.id} staffId={clinician.staffId} startsAt={starts.data} locationId={location.success ? location.data : null} turnstileSiteKey={siteKey} />
    </>
  );
}
