import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { cleanLessonDoc, type BlockNode, type InlineNode } from "@/lib/education/content";
import { videoEmbed } from "@/lib/education/video";

function Inline({ nodes }: { nodes: InlineNode[] | undefined }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => {
        if (node.type === "hardBreak") return <br key={index} />;
        let out: ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") out = <strong>{out}</strong>;
          else if (mark.type === "italic") out = <em>{out}</em>;
          else
            out = (
              <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer" className="text-content underline">
                {out}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            );
        }
        return <Fragment key={index}>{out}</Fragment>;
      })}
    </>
  );
}

function Blocks({ nodes }: { nodes: BlockNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case "paragraph":
            return (
              <p key={index} className="type-body">
                <Inline nodes={node.content} />
              </p>
            );
          case "heading":
            return node.attrs.level === 2 ? (
              <h3 key={index} className="type-card-title mt-2">
                <Inline nodes={node.content} />
              </h3>
            ) : (
              <h4 key={index} className="type-body mt-1 font-medium">
                <Inline nodes={node.content} />
              </h4>
            );
          case "bulletList":
          case "orderedList": {
            const List = node.type === "bulletList" ? "ul" : "ol";
            return (
              <List key={index} className={`type-body flex flex-col gap-1 pl-6 ${node.type === "bulletList" ? "list-disc" : "list-decimal"}`}>
                {node.content.map((item, i) => (
                  <li key={i} className="[&>p]:inline">
                    <Blocks nodes={item.content} />
                  </li>
                ))}
              </List>
            );
          }
          case "blockquote":
            return (
              <blockquote key={index} className="flex flex-col gap-3 border-l-2 border-secondary-border pl-4 text-content-muted">
                <Blocks nodes={node.content} />
              </blockquote>
            );
          case "horizontalRule":
            return <hr key={index} className="border-surface-border" />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** A lesson's text, rendered from the stored document. Only the blocks the editor allows are drawn. */
export function LessonText({ content, fallback }: { content: unknown; fallback?: string | null }) {
  const doc = cleanLessonDoc(content);
  if (doc && doc.content.length > 0) {
    return (
      <div className="flex max-w-prose flex-col gap-4">
        <Blocks nodes={doc.content} />
      </div>
    );
  }
  // Lessons written before the editor hold plain text.
  return fallback ? <p className="type-body max-w-prose whitespace-pre-wrap">{fallback}</p> : null;
}

/** The lesson video in its provider's player, or a plain link when it is not YouTube, Vimeo or Loom. */
export function LessonVideo({ url, title }: { url: string | null; title: string }) {
  if (!url) return null;
  const embed = videoEmbed(url);
  if (!embed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="type-button-label inline-flex items-center gap-2 text-content no-underline">
        <ExternalLink className="size-4" aria-hidden />
        Watch the video
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden border border-surface-border bg-surface-sunken">
      <iframe
        src={embed.src}
        title={`${title}: video on ${embed.provider}`}
        className="absolute inset-0 size-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
