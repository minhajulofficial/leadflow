import { sendResend, verifyResendKey, resendMessage, ResendError } from "../lib/email/resend";
import assert from "node:assert/strict";

const KEY = "re_test_key_that_must_never_leak";
const calls: { url: string; init: any; body?: string }[] = [];
(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({ url, init, body: init?.body });
  if (url === "https://api.resend.com/domains") return { ok: true, json: async () => ({ data: [] }) };
  if (url === "https://api.resend.com/emails") return { ok: true, json: async () => ({ id: "msg_123" }) };
  return { ok: false, status: 404, json: async () => ({ message: "not found" }) };
};

// send: exact endpoint, key ONLY in the Authorization header, never in URL or body
const sent = await sendResend(KEY, { from: "Me <me@x.com>", to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
assert.equal(sent.id, "msg_123");
assert.equal(calls[0].url, "https://api.resend.com/emails");
assert.equal(calls[0].init.headers.Authorization, `Bearer ${KEY}`);
assert.ok(!calls[0].url.includes(KEY), "key must never be in the URL");
assert.ok(!String(calls[0].body).includes(KEY), "key must never be in the body");
assert.ok(!String(calls[0].body).includes("re_test_key"), "key must never leak into the payload");

// verify: domains endpoint, no email sent
assert.equal(await verifyResendKey(KEY), true);
assert.equal(calls[1].url, "https://api.resend.com/domains");

// friendly errors, key never in the message
(globalThis as any).fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: "Invalid API key" }) });
let err: unknown;
try { await sendResend(KEY, { from: "a@b.com", to: "c@d.com", subject: "x", html: "y" }); } catch (e) { err = e; }
assert.ok(err instanceof ResendError);
assert.equal(resendMessage(err), "Resend rejected your API key. Check it in Email > Senders.");
assert.ok(!resendMessage(err).includes(KEY), "error text must never include the key");
assert.equal(resendMessage(new ResendError(429, "slow down")), "Resend is busy right now. The email will be retried automatically.");
assert.equal(resendMessage(new Error("boom")), "Something went wrong talking to Resend.");
console.log("all resend client tests passed");
