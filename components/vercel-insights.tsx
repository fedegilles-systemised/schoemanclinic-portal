"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Every URL is cut to its path before it leaves the browser: query strings and
 * fragments can hold one-time tokens or choices (an emailed link's `token_hash`,
 * `?location=`). Routes must never carry a patient identifier in the path: see
 * docs/SECURITY.md, S-63.
 */
function pathOnly(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

const stripUrl = <T extends { url: string }>(event: T): T => ({ ...event, url: pathOnly(event.url) });

/** Vercel Web Analytics and Speed Insights. Both are cookie-free and only run on Vercel. */
export function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={stripUrl} />
      <SpeedInsights beforeSend={stripUrl} />
    </>
  );
}
