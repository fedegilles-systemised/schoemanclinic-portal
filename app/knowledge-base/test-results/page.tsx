import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { KnowledgeBaseShell, requireKnowledgeBaseReader } from "@/components/knowledge-base/page-shell";

export const metadata: Metadata = {
  title: "Try the results flow · The Schoeman Clinic",
  description: "Step by step: enter a lab report, review and release it, and see what the patient sees.",
  robots: { index: false, follow: false },
};

export default async function TestResultsPage() {
  await requireKnowledgeBaseReader("/knowledge-base/test-results");
  const source = await readFile(path.join(process.cwd(), "content", "test-results-flow.md"), "utf8");

  return (
    <KnowledgeBaseShell
      activePath="/knowledge-base/test-results"
      source={source}
      titleBefore="Try the results "
      titleAccent="flow"
      intro="Follow these steps to enter a lab report, review and release it, and see what the patient sees. Each step says what you should find."
    />
  );
}
