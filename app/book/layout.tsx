import type { Metadata } from "next";

import { Wordmark } from "@/components/ui/wordmark";

export const metadata: Metadata = { title: "Book an appointment · The Schoeman Clinic" };

/** The public booking pages: no sign-in, the clinic's name, and the page. */
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-surface-border bg-surface-inverse px-5 py-4 text-content-inverse shell:px-12">
        <a href="https://theschoemanclinic.com" className="inline-block no-underline" aria-label="The Schoeman Clinic website">
          <Wordmark inverse />
        </a>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 shell:px-8">{children}</main>
      <footer className="type-small border-t border-surface-border px-5 py-6 text-content-muted shell:px-12">
        The Schoeman Clinic · A private Harley Street, Wimbledon and virtual clinic, London. Booking for an existing patient? Use your patient portal.
      </footer>
    </div>
  );
}
