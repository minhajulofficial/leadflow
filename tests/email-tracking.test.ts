import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { signTracking, verifyTracking, pixelUrl, clickUrl, decodeClickTarget, addTracking } from "@/lib/email/tracking";
import { signUnsubscribe } from "@/lib/email/unsubscribe";

const key = randomBytes(32).toString("base64");
const otherKey = randomBytes(32).toString("base64");
const origin = "https://leadflow.example.workers.dev";
let n = 0; const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- signing round trip ---
const tok = await signTracking("rec-123", "user-456", key);
const v = await verifyTracking(tok, key);
assert.deepEqual(v, { recipientId: "rec-123", userId: "user-456" }); ok("signed token verifies to the same recipient + user");
assert.equal(await verifyTracking(tok, otherKey), null); ok("a token is rejected under a different key");
assert.equal(await verifyTracking("garbage", key), null); ok("garbage token is rejected");
await assert.rejects(() => signTracking("r", "u", undefined), /ENCRYPTION_KEY_MISSING/); ok("signing without a key throws (callers must treat tracking as best-effort)");
const unsub = await signUnsubscribe("user-456", "lead@x.com", key);
assert.equal(await verifyTracking(unsub, key), null); ok("an unsubscribe token can never be replayed as a tracking token (purpose prefix)");

// --- pixel + click URLs ---
const pix = pixelUrl(origin, tok);
assert.equal(pix, origin + "/api/email/track/open?token=" + tok); ok("pixel URL points at the open endpoint with the signed token");
const target = "https://acme.com/pricing?a=1&b=2";
const click = clickUrl(origin, tok, target);
assert.ok(click.startsWith(origin + "/api/email/track/click?token=" + tok + "&u="));
assert.equal(decodeClickTarget(new URL(click).searchParams.get("u") ?? ""), target); ok("click URL points at the click endpoint and the target round-trips");
assert.equal(decodeClickTarget("!!!"), null); ok("a malformed click target is rejected");
assert.equal(decodeClickTarget(btoa("javascript:alert(1)").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")), null);
ok("a non-http(s) click target is rejected");

// --- addTracking: linkify + pixel, &amp; handling ---
const html = await addTracking(
  `<p>Hi {{name}}, see <a href="https://acme.com?a=1&amp;b=2">our site</a> and also https://plain.example/x?y=1&amp;z=2</p>`,
  "rec-1", "user-1", origin, key,
);
assert.match(html, /\/api\/email\/track\/click\?/); ok("bare URLs and anchor hrefs are rewritten to tracked click links");
assert.match(html, /\/api\/email\/track\/open\?token=/); ok("a 1px pixel is appended");
assert.doesNotMatch(html, /&amp;amp;/); ok("no double-escaped &amp; in tracked URLs");
const m = html.match(/u=([A-Za-z0-9_-]+)/);
assert.ok(m, "tracked link carries a u= parameter");
assert.equal(decodeClickTarget(m[1]), "https://acme.com?a=1&b=2"); ok("the &amp; inside a href is decoded before encoding (real target kept)");
const plain = await addTracking(`<p>No links here.</p>`, "rec-1", "user-1", origin, key);
assert.match(plain, /track\/open\?token=/); ok("pixel is still added when the body has no links");
const noKey = await addTracking(`<p>See https://x.example</p>`, "rec-1", "user-1", origin, undefined);
assert.doesNotMatch(noKey, /track\//); assert.match(noKey, /https:\/\/x\.example/); ok("without a key the body is returned untouched (fail-open, no tracking)");

console.log(`\nALL ${n} EMAIL TRACKING TESTS PASSED`);
