import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AccentTitle } from "@/components/ui/page-header";
import { Wordmark } from "@/components/ui/wordmark";

export const metadata: Metadata = { title: "Page not found · The Schoeman Clinic", robots: { index: false, follow: false } };

/**
 * Shown for any address that does not exist, and for a record the signed-in person may not open.
 * The two look the same on purpose, so the page never says whether a record exists. The button goes
 * to the home address, which sends each person to their own area or to sign-in.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-5 py-12 text-center">
      <Wordmark />
      <div className="type-eyebrow mt-10 text-content-muted">Page not found</div>
      <h1 className="type-page-title mt-2">
        <AccentTitle title="We could not find " accent="that page" />
      </h1>
      <p className="type-body mt-4 max-w-[48ch] text-content-muted">
        The link may be out of date, or this page may not be open to you. Check the address, or go back to your home page.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Go to your home page</Link>
      </Button>
    </main>
  );
}
