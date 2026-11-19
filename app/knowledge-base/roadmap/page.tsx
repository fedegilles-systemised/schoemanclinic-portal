import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { KnowledgeBaseShell, requireKnowledgeBaseReader } from "@/components/knowledge-base/page-shell";

export const metadata: Metadata = {
  title: "Roadmap · The Schoeman Clinic",
  description: "What is built, what is still to do, and what is holding Clinic Hub back, with who can clear it.",
  robots: { index: false, follow: false },
};

export default async function RoadmapPage() {
  await requireKnowledgeBaseReader("/knowledge-base/roadmap");
  const source = await readFile(path.join(process.cwd(), "content", "roadmap.md"), "utf8");

  return (
    <KnowledgeBaseShell
      activePath="/knowledge-base/roadmap"
      source={source}
      titleBefore="Where Clinic Hub "
      titleAccent="stands"
      intro="What we have built, what is still to do, and what is holding us back, with how to clear each thing and who it depends on."
    />
  );
}
