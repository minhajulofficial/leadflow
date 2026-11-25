/**
 * Error monitoring via Sentry — WITHOUT the Sentry SDK.
 *
 * @sentry/nextjs is not a good fit for this app: it assumes a Node.js
 * Next.js server, while LeadFlow runs on Cloudflare Workers through vinext.
 * Instead this module speaks the Sentry ingest protocol directly (envelope
 * over fetch, which works in Workers and in the browser via the server
 * forwarder). Guarded by SENTRY_DSN: with no DSN set, reporting is a no-op
 * and nothing leaves the server. No real DSN lives in the repo — the
 * placeholder is in .env.example and the real value is a Cloudflare Secret.
 */
import { randomUUID } from "node:crypto";

export type SentryDsn = { host: string; projectId: string; publicKey: string };

export function parseSentryDsn(dsn?: string): SentryDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn.trim());
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\/+/, "").split("/")[0];
    if (!publicKey || !projectId) return null;
    return { host: u.host, projectId, publicKey };
  } catch {
    return null;
  }
}

function sentryEventId(): string {
  try {
    return randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}

export function buildSentryEnvelope(
  dsn: SentryDsn,
  message: string,
  context?: Record<string, string>,
): { url: string; auth: string; body: string } {
  const eventId = sentryEventId();
  const header = JSON.stringify({ event_id: eventId, sdk: { name: "leadflow", version: "0.1.0" } });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: new Date().toISOString(),
    level: "error",
    logger: "leadflow",
    message,
    ...(context && Object.keys(context).length ? { contexts: { leadflow: context } } : {}),
  });
  return {
    url: `https://${dsn.host}/api/${dsn.projectId}/envelope/`,
    auth: `Sentry sentry_version=7, sentry_client=leadflow/0.1.0, sentry_key=${dsn.publicKey}`,
    body: `${header}\n${itemHeader}\n${payload}`,
  };
}

/**
 * Report an error to Sentry. Returns true if it was sent, false if
 * monitoring is off (no DSN) or the send failed. Never throws — a broken
 * reporter must never break the request it is reporting on.
 */
export async function reportError(
  err: unknown,
  context?: Record<string, string>,
  fetchFn: typeof fetch = fetch,
  dsnEnv?: string,
): Promise<boolean> {
  const dsn = parseSentryDsn(dsnEnv ?? process.env.SENTRY_DSN);
  if (!dsn) return false;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const env = buildSentryEnvelope(dsn, message, context);
  try {
    const res = await fetchFn(env.url, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": env.auth },
      body: env.body,
    });
    return res.ok;
  } catch {
    return false;
  }
}
