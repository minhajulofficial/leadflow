import { json, sameOriginJson } from "@/lib/http";
import { checkRateLimit, rateLimitKey, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

/**
 * Browser error-report forwarder. The browser (components/error-reporter)
 * POSTs { message, url }; this route forwards it to Sentry server-side so
 * the SENTRY_DSN never reaches the browser. Same-origin + rate-limited.
 * Always answers { ok: true } — reporting must never leak whether Sentry
 * is configured, and a failed forward is silent.
 */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 400);
  const rl = checkRateLimit(rateLimitKey(req, "error-report"), RATE_LIMITS.errorReport);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  let body: { message?: unknown; url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: true });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "browser error";
  const url = typeof body.url === "string" ? body.url.slice(0, 500) : undefined;
  await reportError(new Error(message), url ? { url, source: "browser" } : { source: "browser" });
  return json({ ok: true });
}
