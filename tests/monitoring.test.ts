import assert from "node:assert/strict";
import { parseSentryDsn, buildSentryEnvelope, reportError } from "@/lib/monitoring";

let n = 0;
const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- DSN parsing ---
assert.equal(parseSentryDsn(undefined), null);
assert.equal(parseSentryDsn(""), null);
assert.equal(parseSentryDsn("not-a-url"), null);
assert.equal(parseSentryDsn("https://o0.ingest.sentry.io/123"), null); // no public key
const dsn = parseSentryDsn("https://abc123@o0.ingest.sentry.io/456");
assert.deepEqual(dsn, { host: "o0.ingest.sentry.io", projectId: "456", publicKey: "abc123" });
ok("parses a real Sentry DSN, rejects garbage");

// --- envelope shape ---
const env = buildSentryEnvelope(dsn!, "Error: boom", { url: "https://x.test/login", source: "browser" });
assert.equal(env.url, "https://o0.ingest.sentry.io/api/456/envelope/");
assert.match(env.auth, /sentry_key=abc123/);
const lines = env.body.split("\n");
assert.equal(lines.length, 3);
const header = JSON.parse(lines[0]);
const payload = JSON.parse(lines[2]);
assert.equal(typeof header.event_id, "string");
assert.equal(header.event_id.length, 32);
assert.equal(JSON.parse(lines[1]).type, "event");
assert.equal(payload.level, "error");
assert.equal(payload.message, "Error: boom");
assert.equal(payload.contexts.leadflow.url, "https://x.test/login");
ok("envelope has Sentry header, item header, and event payload");

// --- reportError is a no-op without a DSN (and never throws) ---
const calls: unknown[] = [];
const fakeFetch = async (...args: unknown[]) => { calls.push(args); return { ok: true } as unknown as Response; };
assert.equal(await reportError(new Error("x"), undefined, fakeFetch as typeof fetch, undefined), false);
assert.equal(calls.length, 0);
ok("no DSN means nothing is sent");

// --- reportError sends to the right URL with the envelope ---
assert.equal(
  await reportError(new Error("kaboom"), { source: "server" }, fakeFetch as typeof fetch, "https://abc123@o0.ingest.sentry.io/456"),
  true,
);
assert.equal(calls.length, 1);
const [sentUrl, sentInit] = calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
assert.equal(sentUrl, "https://o0.ingest.sentry.io/api/456/envelope/");
assert.equal(sentInit.method, "POST");
assert.match(sentInit.headers["x-sentry-auth"], /sentry_key=abc123/);
assert.match(sentInit.body, /kaboom/);
ok("with a DSN, the envelope is POSTed to the Sentry ingest URL");

// --- a failing send returns false, never throws ---
const failingFetch = async () => { throw new Error("network down"); };
assert.equal(
  await reportError(new Error("x"), undefined, failingFetch as unknown as typeof fetch, "https://abc123@o0.ingest.sentry.io/456"),
  false,
);
ok("a broken reporter never throws");

// --- a non-2xx Sentry reply returns false ---
const badFetch = async () => ({ ok: false }) as unknown as Response;
assert.equal(
  await reportError(new Error("x"), undefined, badFetch as typeof fetch, "https://abc123@o0.ingest.sentry.io/456"),
  false,
);
ok("a rejected envelope returns false");

console.log(`ALL ${n} MONITORING TESTS PASSED`);
