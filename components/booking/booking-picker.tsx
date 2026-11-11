import { BookSlotButton } from "@/components/booking/book-slot";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DaySlots } from "@/lib/booking/slots";
import { dayHeading, londonParts } from "@/lib/calendar/time";
import type { BookingOptions } from "@/lib/data/appointments";

/**
 * Choose a type and a clinician (a plain GET form, so the page reloads with free times), then a time.
 * Used in the patient portal and on a patient's record in the clinic.
 */
export function BookingPicker({
  action,
  patientId,
  back,
  options,
  typeId,
  staffId,
  days,
}: {
  action: string;
  patientId: string;
  back: "portal" | "clinic";
  options: BookingOptions;
  typeId?: string;
  staffId?: string;
  days: DaySlots[] | null;
}) {
  const type = options.types.find((t) => t.id === typeId);
  const clinician = options.clinicians.find((c) => c.staffId === staffId);
  if (options.types.length === 0 || options.clinicians.length === 0) {
    return (
      <EmptyState>
        {options.clinicians.length === 0
          ? "There is no clinician to book with yet. Please contact the clinic."
          : "No appointments can be booked online yet. Please contact the clinic."}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <form method="get" action={action} className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="book-type">Appointment</Label>
          <Select id="book-type" name="type" defaultValue={type?.id ?? ""} required>
            <option value="" disabled>
              Choose an appointment
            </option>
            {options.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.durationMin} minutes, {t.locationKind === "video" ? "video" : "in clinic"})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="book-staff">With</Label>
          <Select id="book-staff" name="staff" defaultValue={clinician?.staffId ?? ""} required>
            <option value="" disabled>
              Choose a clinician
            </option>
            {options.clinicians.map((c) => (
              <option key={c.staffId} value={c.staffId}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Show free times
        </Button>
      </form>

      {type && clinician && days ? (
        days.every((d) => d.slots.length === 0) ? (
          <EmptyState>No free times in the next two weeks. Please contact the clinic.</EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {days
              .filter((d) => d.slots.length > 0)
              .map((d) => (
                <section key={d.day} aria-labelledby={`slots-${d.day}`} className="flex flex-col gap-3">
                  <h3 id={`slots-${d.day}`} className="type-card-title">
                    {dayHeading(d.day)}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {d.slots.map((slot) => {
                      const time = londonParts(slot.startsAt).time ?? "";
                      return (
                        <BookSlotButton
                          key={slot.startsAt}
                          patientId={patientId}
                          staffId={clinician.staffId}
                          typeId={type.id}
                          startsAt={slot.startsAt}
                          locationId={slot.locationId}
                          back={back}
                          label={time}
                          confirmText={`Book ${type.name.toLowerCase()} with ${clinician.name} on ${dayHeading(d.day)} at ${time}?`}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        )
      ) : null}
    </div>
  );
}
