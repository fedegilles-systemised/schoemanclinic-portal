import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Wordmark } from "@/components/ui/wordmark";
import { getPublicEnv } from "@/lib/env";

/** Split layout. On phones the dark panel collapses to a short band. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const demo = getPublicEnv().NEXT_PUBLIC_DEMO === "true";

  return (
    <div className="flex min-h-dvh flex-col">
      {demo ? <DemoBanner /> : null}
      <div className="grid flex-1 grid-cols-1 shell:grid-cols-[55%_45%]">
        <aside className="flex flex-col justify-between gap-4 bg-surface-inverse p-7 text-content-inverse shell:p-12">
          <Wordmark inverse />
          <div className="hidden flex-col gap-4 shell:flex">
            <p className="type-eyebrow">A private Harley Street &amp; Wimbledon clinic</p>
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
