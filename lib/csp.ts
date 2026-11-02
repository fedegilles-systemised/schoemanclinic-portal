const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): { http: string; ws: string } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: "", ws: "" };
  const url = new URL(raw);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return { http: url.origin, ws: `${wsProtocol}//${url.host}` };
}

/** A fresh value for every request: the proxy makes one and Next.js adds it to its own scripts. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * The page policy. Scripts need the request's nonce, so injected script cannot run.
 * Styles still allow inline: React and Radix write style attributes that a nonce
 * cannot cover (see docs/SECURITY.md, S-12).
 */
export function contentSecurityPolicy(nonce: string): string {
  const supabase = supabaseOrigins();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase.http}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase.http} ${supabase.ws}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
