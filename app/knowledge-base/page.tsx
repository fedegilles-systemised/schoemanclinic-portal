import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { KnowledgeBaseShell, requireKnowledgeBaseReader } from "@/components/knowledge-base/page-shell";

export const metadata: Metadata = {
  title: "Knowledge base · The Schoeman Clinic",
  description: "Who uses Clinic Hub, what each role can see and do, and how the main journeys work.",
  robots: { index: false, follow: false },
};

export default async function KnowledgeBasePage() {
  await requireKnowledgeBaseReader("/knowledge-base");
  const source = await readFile(path.join(process.cwd(), "content", "knowledge-base.md"), "utf8");

  return (
    <KnowledgeBaseShell
      activePath="/knowledge-base"
      source={source}
      titleBefore="How Clinic Hub "
      titleAccent="works"
      intro="Who uses the platform, what each role can see and do, which screens exist, and how the main journeys run."
    />
  );
}
