"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/profile/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookOnline, type OnlineBookingState } from "@/lib/booking/online-actions";

const initial: OnlineBookingState = {};

/** The new patient's details for an online booking. */
export function OnlineBookingForm({ typeId, staffId, startsAt, locationId, turnstileSiteKey }: { typeId: string; staffId: string; startsAt: string; locationId: string | null; turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState(bookOnline, initial);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="typeId" value={typeId} />
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      {locationId ? <input type="hidden" name="locationId" value={locationId} /> : null}
      {/* Left empty by people; filled by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" maxLength={80} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" maxLength={80} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" autoComplete="bday" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={20} required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
        </div>
      </div>
      <label className="type-body flex items-start gap-2">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-secondary" />
        <span>
          I have read the clinic&apos;s{" "}
          <a href="https://theschoemanclinic.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-content underline">
            privacy notice
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          and{" "}
          <a href="https://theschoemanclinic.com/terms/" target="_blank" rel="noopener noreferrer" className="text-content underline">
            terms
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          , and agree to the clinic contacting me about this appointment.
        </span>
      </label>
      {turnstileSiteKey ? <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light" /> : null}
      <FormMessage state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Book appointment
        </Button>
      </div>
    </form>
  );
}
