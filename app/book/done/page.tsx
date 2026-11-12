import { PageHeader } from "@/components/ui/page-header";

/** After an online booking. Says nothing about the booking itself, so the page can be shared or reloaded safely. */
export default function BookDonePage() {
  return (
    <>
      <PageHeader eyebrow="Book an appointment" title="Thank " accent="you" description="Your appointment is booked, and a confirmation email is on its way." />
      <p className="type-body max-w-prose">
        The clinic will be in touch before your appointment to confirm your details and invite you to your patient portal. If the email does not arrive, please check your junk folder or
        contact the clinic.
      </p>
    </>
  );
}
