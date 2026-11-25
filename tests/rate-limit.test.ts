import assert from "node:assert/strict";
import { checkRateLimit, rateLimitKey, rateLimitResponse, resetRateLimits, RATE_LIMITS, clientIp } from "@/lib/rate-limit";

let n = 0;
const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- basic allow/block within one window ---
resetRateLimits();
const cfg = { limit: 3, windowMs: 60_000 };
assert.equal(checkRateLimit("k1", cfg, 1000).ok, true);
assert.equal(checkRateLimit("k1", cfg, 1001).ok, true);
assert.equal(checkRateLimit("k1", cfg, 1002).ok, true);
assert.equal(checkRateLimit("k1", cfg, 1003).ok, false);
ok("allows up to the limit, then blocks");

// --- blocked key reports a retry delay inside the window ---
const blocked = checkRateLimit("k1", cfg, 1004);
assert.equal(blocked.ok, false);
assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 60_000);
ok("blocked key reports a retry-after inside the window");

// --- a fresh window allows again ---
assert.equal(checkRateLimit("k1", cfg, 1000 + 60_000).ok, true);
ok("a new window allows again");

// --- keys are independent ---
resetRateLimits();
assert.equal(checkRateLimit("a", cfg, 2000).ok, true);
assert.equal(checkRateLimit("b", cfg, 2000).ok, true);
assert.equal(checkRateLimit("a", cfg, 2001).ok, true);
assert.equal(checkRateLimit("a", cfg, 2002).ok, true);
assert.equal(checkRateLimit("a", cfg, 2003).ok, false);
assert.equal(checkRateLimit("b", cfg, 2003).ok, true);
ok("different keys have independent buckets");

// --- real limits are sane (tracking generous, deletion strict) ---
assert.ok(RATE_LIMITS.track.limit >= 60, "tracking limit is generous");
assert.ok(RATE_LIMITS.accountDelete.limit <= 5, "deletion limit is strict");
assert.ok(RATE_LIMITS.webhook.limit > RATE_LIMITS.unsubscribe.limit, "webhooks allow bursts, unsubscribe does not");
ok("configured limits match their intent");

// --- client IP prefers the Cloudflare header ---
const req = (headers: Record<string, string>) => new Request("https://x.test/api", { headers });
assert.equal(clientIp(req({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" })), "1.2.3.4");
assert.equal(clientIp(req({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" })), "5.6.7.8");
assert.equal(clientIp(req({})), "unknown");
ok("client IP prefers cf-connecting-ip, then x-forwarded-for");

// --- rateLimitKey scopes by route + IP ---
assert.notEqual(rateLimitKey(req({ "cf-connecting-ip": "1.1.1.1" }), "a"), rateLimitKey(req({ "cf-connecting-ip": "1.1.1.1" }), "b"));
assert.notEqual(rateLimitKey(req({ "cf-connecting-ip": "1.1.1.1" }), "a"), rateLimitKey(req({ "cf-connecting-ip": "2.2.2.2" }), "a"));
ok("rate-limit keys are scoped by route and IP");

// --- 429 response shape ---
const r429 = rateLimitResponse(2500);
assert.equal(r429.status, 429);
assert.equal(r429.headers.get("retry-after"), "3");
assert.match(r429.headers.get("content-type") ?? "", /application\/json/);
ok("429 response carries Retry-After in seconds");

console.log(`ALL ${n} RATE-LIMIT TESTS PASSED`);
