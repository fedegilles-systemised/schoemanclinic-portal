import Link from "next/link";
import { redirect } from "next/navigation";

import { Contents } from "@/components/knowledge-base/contents";
import { Markdown, slugify } from "@/components/knowledge-base/markdown";
import { UserFlowsMenu } from "@/components/knowledge-base/user-flows-menu";
import { SessionGuard } from "@/components/shell/session-guard";
import { AccentTitle } from "@/components/ui/page-header";
import { Wordmark } from "@/components/ui/wordmark";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { FLOW_GUIDES, flowHref } from "@/lib/knowledge-base/flows";
import { cn } from "@/lib/utils";

const HOW_IT_WORKS = { href: "/knowledge-base", label: "How it works" } as const;
const ROADMAP = { href: "/knowledge-base/roadmap", label: "Roadmap" } as const;

/** The step-by-step guides under the "User flows" tab. Add a guide in lib/knowledge-base/flows.ts. */
const USER_FLOWS = FLOW_GUIDES.map((flow) => ({ href: flowHref(flow.slug), label: flow.label }));

function TabLink({ tab, activePath }: { tab: { href: string; label: string }; activePath: string }) {
  const active = tab.href === activePath;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn("border-b pb-1", active ? "border-content text-content" : "border-transparent text-content-muted hover:text-content")}
    >
      {tab.label}
    </Link>
  );
}

/**
 * For signed-in admins only. It holds no patient or account data, but it describes how the
 * platform protects them, so it is not public. The proxy sends signed-out visitors to sign in
 * and brings them back; this checks again, as the server layouts do.
 */
export async function requireKnowledgeBaseReader(returnPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${returnPath}`);
  if (!user.isAdmin || user.isSuspended) redirect(homePathFor(user) ?? "/login?error=no-access");
}

export function KnowledgeBaseShell({
  activePath,
  source,
  titleBefore,
  titleAccent,
  intro,
}: {
  activePath: string;
  source: string;
  titleBefore: string;
  titleAccent: string;
  intro: string;
}) {
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
            <AccentTitle title={titleBefore} accent={titleAccent} />
          </h1>
          <p className="type-body mt-4 max-w-[58ch] text-content-muted">{intro}</p>
          <nav aria-label="Knowledge base" className="type-eyebrow mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
            <TabLink tab={HOW_IT_WORKS} activePath={activePath} />
            <UserFlowsMenu flows={USER_FLOWS} activePath={activePath} />
            <TabLink tab={ROADMAP} activePath={activePath} />
          </nav>
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
