/**
 * Lesson text, as written in the editor (Tiptap) and stored in education_modules.content. Only a
 * fixed set of blocks and marks is kept: anything else is dropped before saving, and links must be
 * https or mailto, so a lesson can never carry script or a dangerous link to a patient. The same
 * check runs again before rendering.
 */

export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type InlineNode = TextNode | { type: "hardBreak" };
export type BlockNode =
  | { type: "paragraph"; content?: InlineNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: InlineNode[] }
  | { type: "bulletList"; content: ListItem[] }
  | { type: "orderedList"; content: ListItem[] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "horizontalRule" };
export type ListItem = { type: "listItem"; content: BlockNode[] };
export type LessonDoc = { type: "doc"; content: BlockNode[] };

const MAX_TEXT = 100_000;
const MAX_NODES = 5_000;

type Unknown = Record<string, unknown>;
const isObject = (value: unknown): value is Unknown => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A link the lesson may carry: https or mailto only. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "mailto:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Keeps only what the lesson may hold. Returns null for something that is not a document at all,
 * or that is too large.
 */
export function cleanLessonDoc(input: unknown): LessonDoc | null {
  if (!isObject(input) || input.type !== "doc") return null;
  let nodes = 0;
  let characters = 0;

  const inline = (value: unknown): InlineNode[] => {
    const out: InlineNode[] = [];
    for (const node of list(value)) {
      if (!isObject(node) || ++nodes > MAX_NODES) continue;
      if (node.type === "hardBreak") {
        out.push({ type: "hardBreak" });
      } else if (node.type === "text" && typeof node.text === "string" && node.text.length > 0) {
        characters += node.text.length;
        const marks: Mark[] = [];
        for (const mark of list(node.marks)) {
          if (!isObject(mark)) continue;
          if (mark.type === "bold" || mark.type === "italic") marks.push({ type: mark.type });
          if (mark.type === "link" && isObject(mark.attrs)) {
            const href = safeHref(mark.attrs.href);
            if (href) marks.push({ type: "link", attrs: { href } });
          }
        }
        out.push(marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text });
      }
    }
    return out;
  };

  const items = (value: unknown): ListItem[] =>
    list(value).flatMap((item) => (isObject(item) && item.type === "listItem" ? [{ type: "listItem" as const, content: blocks(item.content) }] : []));

  const blocks = (value: unknown): BlockNode[] => {
    const out: BlockNode[] = [];
    for (const node of list(value)) {
      if (!isObject(node) || ++nodes > MAX_NODES) continue;
      switch (node.type) {
        case "paragraph":
          out.push({ type: "paragraph", content: inline(node.content) });
          break;
        case "heading": {
          const level = isObject(node.attrs) && node.attrs.level === 3 ? 3 : 2;
          out.push({ type: "heading", attrs: { level }, content: inline(node.content) });
          break;
        }
        case "bulletList":
        case "orderedList":
          out.push({ type: node.type, content: items(node.content) });
          break;
        case "blockquote":
          out.push({ type: "blockquote", content: blocks(node.content) });
          break;
        case "horizontalRule":
          out.push({ type: "horizontalRule" });
          break;
        default:
          break;
      }
    }
    return out;
  };

  const doc: LessonDoc = { type: "doc", content: blocks(input.content) };
  if (nodes > MAX_NODES || characters > MAX_TEXT) return null;
  return doc;
}

/** True when the lesson has no words in it. */
export function isEmptyDoc(doc: LessonDoc | null): boolean {
  if (!doc) return true;
  const hasText = (nodes: unknown[]): boolean =>
    nodes.some((node) => isObject(node) && ((node.type === "text" && typeof node.text === "string" && node.text.trim() !== "") || hasText(list(node.content))));
  return !hasText(doc.content);
}
