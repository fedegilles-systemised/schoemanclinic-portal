/**
 * Pages a person may be sent back to after signing in. A fixed list, never the raw
 * value from the address bar, so the sign-in page cannot redirect off-site.
 */
const RETURN_PATHS: readonly string[] = ["/knowledge-base"];

/** The path if it is on the list, otherwise null. */
export function parseReturnPath(value: unknown): string | null {
  return typeof value === "string" && RETURN_PATHS.includes(value) ? value : null;
}
