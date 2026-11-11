import type { NextConfig } from "next";

// The Content-Security-Policy is set per request in lib/supabase/proxy.ts, because it
// carries a nonce. These headers are the same for every response.
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Photos, signatures and lab reports are uploaded through server actions: 10 MiB at most (lab reports), plus form overhead.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The microphone and screen-share audio are for recording calls from a patient's record, on this site only.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), display-capture=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
