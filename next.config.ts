import type { NextConfig } from "next";

/**
 * Security headers (Phase 8.4, PRD NFR-S8). Applied to every route.
 *
 * CSP notes: script/style 'unsafe-inline' is required — Next.js streams
 * server components with inline scripts, and a strict CSP without it breaks
 * the app. The policy still blocks what matters: no foreign scripts, no
 * framing (frame-ancestors 'none' + X-Frame-Options), forms only to self.
 * connect-src lists the app's real third parties (Supabase, Resend, DoH
 * resolvers, Gemini/OpenAI for the AI writer). Verify live after deploy:
 * `curl -I https://<domain>/` should show these headers.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://dns.google https://cloudflare-dns.com https://generativelanguage.googleapis.com https://api.openai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
