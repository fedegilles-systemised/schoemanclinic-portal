"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Undo2, Unlink, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeHref } from "@/lib/education/content";
import { cn } from "@/lib/utils";

function ToolButton({ label, icon: Icon, active, disabled, onClick }: { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-control-sm items-center justify-center text-content-muted hover:bg-surface-selected hover:text-content disabled:opacity-40",
        active && "bg-surface-selected text-content",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const applyLink = () => {
    const safe = safeHref(/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(href.trim()) ? `mailto:${href.trim()}` : href);
    if (!safe) {
      setLinkError("Use a link that starts with https:// or an email address.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    setLinking(false);
    setHref("");
    setLinkError(null);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-surface-border p-1.5">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
        <ToolButton label="Heading" icon={Heading2} active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolButton label="Subheading" icon={Heading3} active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="mx-1 h-5 w-px bg-surface-border" aria-hidden />
        <ToolButton label="Bold" icon={Bold} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton label="Italic" icon={Italic} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton
          label={state.link ? "Remove link" : "Add a link"}
          icon={state.link ? Unlink : Link2}
          active={state.link || linking}
          onClick={() => {
            if (state.link) editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else setLinking((open) => !open);
          }}
        />
        <span className="mx-1 h-5 w-px bg-surface-border" aria-hidden />
        <ToolButton label="Bulleted list" icon={List} active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton label="Numbered list" icon={ListOrdered} active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="Quote" icon={Quote} active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolButton label="Divider" icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <span className="mx-1 h-5 w-px bg-surface-border" aria-hidden />
        <ToolButton label="Undo" icon={Undo2} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
        <ToolButton label="Redo" icon={Redo2} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
      </div>
      {linking ? (
        <div className="flex flex-col gap-1.5 px-1 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Link address"
              placeholder="https:// or an email address"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") setLinking(false);
              }}
              className="max-w-sm"
              autoFocus
            />
            <Button type="button" size="sm" variant="outline" onClick={applyLink}>
              Add link
            </Button>
          </div>
          {linkError ? <p className="type-small text-status-danger">{linkError}</p> : <p className="type-small text-content-muted">Select the words first, then add the link.</p>}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The lesson text editor: headings, bold, italic, links, lists, quotes and dividers, and nothing
 * else. The document is kept in a hidden field for the form; the server cleans it again.
 */
export function RichTextEditor({ name, initial, labelledBy }: { name: string; initial: unknown; labelledBy: string }) {
  const [value, setValue] = useState(() => JSON.stringify(initial ?? { type: "doc", content: [] }));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["https", "mailto"],
          isAllowedUri: (url) => safeHref(url) !== null,
        },
      }),
    ],
    content: (initial as object | null) ?? { type: "doc", content: [] },
    editorProps: {
      attributes: {
        "aria-labelledby": labelledBy,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "lesson-editor type-body min-h-64 px-4 py-3 focus:outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-secondary-border [&_blockquote]:pl-4 [&_blockquote]:text-content-muted [&_h2]:type-card-title [&_h3]:font-medium [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_hr]:border-surface-border [&>*+*]:mt-3",
      },
    },
    onUpdate: ({ editor: e }) => setValue(JSON.stringify(e.getJSON())),
  });

  return (
    <div className="border border-surface-border bg-surface-raised focus-within:border-secondary-border">
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b border-surface-border" aria-hidden />}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
