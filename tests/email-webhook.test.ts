import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { verifySvixSignature, extractReplyTargetIds } from "@/lib/email/webhook";

let n = 0; const ok = (m: string) => console.log(`ok ${++n} ${m}`);
// The webhook secret is base64 (Resend issues whsec_<base64>); the signer
// decodes it, so the test secret must be real base64 too.
const secret = "whsec_" + randomBytes(16).toString("base64");
const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
const body = JSON.stringify({ type: "email.bounced", data: { email_id: "re_123", email: "lead@x.com" } });
const sign = (id: string, ts: string, payload: string) =>
  `v1,${createHmac("sha256", keyBytes).update(`${id}.${ts}.${payload}`).digest("base64")}`;
const now = String(Math.floor(Date.now() / 1000));

// --- Svix verification ---
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: sign("msg_1", now, body) }, secret), true);
ok("a correctly signed Resend webhook verifies");
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: sign("msg_1", now, body) }, "whsec_" + randomBytes(16).toString("base64")), false);
ok("the wrong secret fails verification");
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: sign("msg_1", now, body + "tampered") }, secret), false);
ok("a tampered body fails verification");
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: String(Math.floor(Date.now() / 1000) - 600), signature: sign("msg_1", now, body) }, secret), false);
ok("a timestamp older than 5 minutes is rejected (replay protection)");
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: "" }, secret), false);
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: sign("msg_1", now, body) }, undefined), false);
ok("missing headers or a missing secret fail closed");
const multi = `v0,${"A".repeat(44)} ${sign("msg_1", now, body)}`;
assert.equal(await verifySvixSignature(body, { id: "msg_1", timestamp: now, signature: multi }, secret), true);
ok("several space-separated signatures are tried until one v1 matches");

// --- reply target extraction (from headers, not the payload) ---
const uuid = "49a3999c-0ce1-4ea6-ab68-af1b2080dc96";
assert.deepEqual(
  extractReplyTargetIds({ "In-Reply-To": `<${uuid}@resend>`, References: `<other@x.com>` }),
  [uuid],
); ok("an inbound reply is mapped back to its sent email via In-Reply-To");
assert.deepEqual(extractReplyTargetIds({ "In-Reply-To": "no ids here" }), []); ok("headers with no UUID map to nothing (no guessing)");

console.log(`\nALL ${n} EMAIL WEBHOOK TESTS PASSED`);
