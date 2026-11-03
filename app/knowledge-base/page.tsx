import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Contents } from "@/components/knowledge-base/contents";
import { Markdown, slugify } from "@/components/knowledge-base/markdown";
import { SessionGuard } from "@/components/shell/session-guard";
import { AccentTitle } from "@/components/ui/page-header";
import { Wordmark } from "@/components/ui/wordmark";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Knowledge base · The Schoeman Clinic",
  description: "Who uses Clinic Hub, what each role can see and do, and how the main journeys work.",
  robots: { index: false, follow: false },
};

/**
 * For signed-in admins only. It holds no patient or account data, but it describes how the
 * platform protects them, so it is not public. The proxy sends signed-out visitors to sign in
 * and brings them back; this page checks again, as the server layouts do.
 */
export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/knowledge-base");
  if (!user.isAdmin || user.isSuspended) redirect(homePathFor(user) ?? "/login?error=no-access");

  const source = await readFile(path.join(process.cwd(), "content", "knowledge-base.md"), "utf8");
  const sections = Array.from(source.matchAll(/^## (.+)$/gm), (match) => ({ id: slugify(match[1]), title: match[1] }));

  return (
    <div className="min-h-dvh">
      <SessionGuard kind="staff" />
      <main className="mx-auto max-w-[1160px] px-5 pb-12 shell:pb-16">
        <div className="type-table py-6 text-right">
          <Link href="/clinic" className="text-secondary underline underline-offset-4 hover:text-content">
            Back to the clinic
          </Link>
        </div>
        <header className="mb-10 flex flex-col items-center text-center shell:mb-14">
          <Wordmark />
          <div className="type-eyebrow mt-10 text-content-muted">Knowledge base</div>
          <h1 className="type-page-title mt-2">
            <AccentTitle title="How Clinic Hub " accent="works" />
          </h1>
          <p className="type-body mt-4 max-w-[58ch] text-content-muted">
            Who uses the platform, what each role can see and do, which screens exist, and how the main journeys run.
          </p>
        </header>

        <div className="shell:grid shell:grid-cols-[220px_minmax(0,1fr)] shell:gap-12">
          <Contents items={sections} />
          <Markdown source={source} />
        </div>

        <footer className="type-small mt-20 border-t border-surface-border pt-6 text-center text-content-muted">
          The Schoeman Clinic · Clinic Hub
        </footer>
      </main>
    </div>
  );
}
