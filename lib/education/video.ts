/**
 * Lesson videos are links to YouTube, Vimeo or Loom, shown in the provider's own player. Only these
 * three are embedded (the page's security policy allows their players and nothing else); any other
 * link is offered as a plain link instead.
 */
export type VideoEmbed = { provider: "YouTube" | "Vimeo" | "Loom"; src: string };

export function videoEmbed(link: string | null | undefined): VideoEmbed | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const id = (value: string | null | undefined, pattern: RegExp) => (value && pattern.test(value) ? value : null);

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    const videoId =
      host === "youtu.be"
        ? id(parts[0], /^[\w-]{6,20}$/)
        : parts[0] === "watch"
          ? id(url.searchParams.get("v"), /^[\w-]{6,20}$/)
          : ["embed", "shorts", "live"].includes(parts[0] ?? "")
            ? id(parts[1], /^[\w-]{6,20}$/)
            : null;
    return videoId ? { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const numbers = parts.filter((p) => /^\d{4,12}$/.test(p));
    const videoId = numbers[0];
    if (!videoId) return null;
    // An unlisted Vimeo video carries a privacy hash, in the path or as ?h=.
    const after = parts[parts.indexOf(videoId) + 1];
    const hash = id(url.searchParams.get("h") ?? after, /^[0-9a-f]{6,20}$/);
    return { provider: "Vimeo", src: `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ""}` };
  }
  if (host === "loom.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const videoId = ["share", "embed"].includes(parts[0] ?? "") ? id(parts[1], /^[0-9a-f]{20,40}$/) : null;
    return videoId ? { provider: "Loom", src: `https://www.loom.com/embed/${videoId}` } : null;
  }
  return null;
}

/** The players the page's security policy lets the lesson embed. */
export const VIDEO_FRAME_SOURCES = ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.loom.com"] as const;
