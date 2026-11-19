import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KnowledgeBaseShell, requireKnowledgeBaseReader } from "@/components/knowledge-base/page-shell";
import { findFlow, flowHref } from "@/lib/knowledge-base/flows";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const flow = findFlow((await params).slug);
  return {
    title: flow ? `${flow.label} · The Schoeman Clinic` : "Knowledge base · The Schoeman Clinic",
    description: flow?.intro,
    robots: { index: false, follow: false },
  };
}

export default async function FlowPage({ params }: Props) {
  const { slug } = await params;
  // Only slugs on the list are ever turned into a file name.
  const flow = findFlow(slug);
  if (!flow) notFound();
  await requireKnowledgeBaseReader(flowHref(flow.slug));
  const source = await readFile(path.join(process.cwd(), "content", "flows", `${flow.slug}.md`), "utf8");

  return (
    <KnowledgeBaseShell
      activePath={flowHref(flow.slug)}
      source={source}
      titleBefore={flow.titleBefore}
      titleAccent={flow.titleAccent}
      intro={flow.intro}
    />
  );
}
