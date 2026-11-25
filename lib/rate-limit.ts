/**
 * Edge-safe, in-memory rate limiter (token bucket per key, fixed window).
 *
 * Workers run many isolates, so this is PER-ISOLATE state: a burst spread
 * across isolates can exceed the nominal limit. That is acceptable for
 * abuse caps (it still stops a single client hammering one isolate) and
 * is documented in SETUP.md. A global limit needs Cloudflare KV or
 * Durable Objects — a follow-up if abuse ever becomes a real problem.
 * The store is bounded (oldest entries dropped past MAX_ENTRIES) so a
 * long-running isolate cannot grow memory without bound.
 */
export type RateLimitConfig = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  /** Public tracking pixel / click redirect: best-effort, generous. */
  track: { limit: 120, windowMs: 60_000 },
  /** One-click unsubscribe page. */
  unsubscribe: { limit: 10, windowMs: 60_000 },
  /** Resend webhooks (delivery/bounce/reply). Resend retries in bursts. */
  webhook: { limit: 300, windowMs: 60_000 },
  /** Email queue worker: cron hits every 5 min + the user button. */
  queueProcess: { limit: 12, windowMs: 60_000 },
  /** Email address validation endpoint (signed-in). */
  validate: { limit: 30, windowMs: 60_000 },
  /** Browser error reports forwarded to Sentry. */
  errorReport: { limit: 10, windowMs: 60_000 },
  /** Account data export (signed-in). */
  accountExport: { limit: 10, windowMs: 60_000 },
  /** Account deletion (signed-in, destructive). */
  accountDelete: { limit: 3, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

const MAX_ENTRIES = 10_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  cfg: RateLimitConfig,
  now = Date.now(),
): { ok: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    if (buckets.size >= MAX_ENTRIES) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + cfg.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count < cfg.limit) {
    b.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
  return { ok: false, retryAfterMs: b.resetAt - now };
}

/** Test/ops helper: clear all buckets (never used in production code). */
export function resetRateLimits() {
  buckets.clear();
}

/** Best-effort client IP: Cloudflare header first, then X-Forwarded-For. */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export function rateLimitKey(req: Request, scope: string): string {
  return `${scope}:${clientIp(req)}`;
}

/** 429 JSON response with a Retry-After header (seconds, rounded up). */
export function rateLimitResponse(retryAfterMs: number): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(seconds), "cache-control": "no-store" },
  });
}
