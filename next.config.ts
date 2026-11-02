import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): { http: string; ws: string } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: "", ws: "" };
  const url = new URL(raw);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return { http: url.origin, ws: `${wsProtocol}//${url.host}` };
}

// Starter policy: self plus the Supabase project. The inline allowance is needed
// for the Next.js bootstrap scripts until nonces are added (see docs/SECURITY.md).
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigins();
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
