import Image from "next/image";

import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Wordmark } from "@/components/ui/wordmark";
import { getPublicEnv } from "@/lib/env";

/**
 * Split layout. On phones the dark panel collapses to a short band. The photograph sits
 * behind a flat surface-inverse overlay, as the design system requires.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const demo = getPublicEnv().NEXT_PUBLIC_DEMO === "true";

  return (
    <div className="flex min-h-dvh flex-col">
      {demo ? <DemoBanner /> : null}
      <div className="grid flex-1 grid-cols-1 shell:grid-cols-[55%_45%]">
        <aside className="relative isolate flex flex-col justify-between gap-4 overflow-hidden bg-surface-inverse p-7 text-content-inverse shell:p-12">
          <Image
            src="/pics/about-clinic-door.png"
            alt=""
            fill
            priority
            sizes="(min-width: 900px) 55vw, 100vw"
            className="-z-20 object-cover object-[65%_50%]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-surface-inverse/80" />
          <Wordmark inverse />
          <div className="hidden flex-col gap-4 shell:flex">
            <p className="type-eyebrow">A private Harley Street, Wimbledon and virtual clinic</p>
            <p className="type-hero-title max-w-[12ch]">
              Your health, <em className="text-accent italic">in one place</em>.
            </p>
          </div>
        </aside>
        <main className="flex items-center justify-center p-5 shell:p-12">
          <Card className="w-full max-w-[420px] gap-5 p-8">{children}</Card>
        </main>
      </div>
    </div>
  );
}
