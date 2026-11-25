import { signUnsubscribe, verifyUnsubscribe } from "../lib/email/unsubscribe";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const keyB64 = randomBytes(32).toString("base64");
const otherKeyB64 = randomBytes(32).toString("base64");

// roundtrip: sign then verify returns the same (user, email)
const token = await signUnsubscribe("user-uuid-1", "Lead@Example.com", keyB64);
const v = await verifyUnsubscribe(token, keyB64);
assert.deepEqual(v, { userId: "user-uuid-1", email: "lead@example.com" }); // email lower-cased

// tampered token (one char changed) is rejected
const bad = token.slice(0, -2) + (token.slice(-2, -1) === "A" ? "B" : "A") + token.slice(-1);
assert.equal(await verifyUnsubscribe(bad, keyB64), null);
// token for another address cannot be reused for a different email
const other = await signUnsubscribe("user-uuid-1", "someone@else.com", keyB64);
assert.notEqual(other, token);
assert.deepEqual(await verifyUnsubscribe(other, keyB64), { userId: "user-uuid-1", email: "someone@else.com" });
// wrong key rejects
assert.equal(await verifyUnsubscribe(token, otherKeyB64), null);
// garbage rejects
assert.equal(await verifyUnsubscribe("not-a-token", keyB64), null);
assert.equal(await verifyUnsubscribe("", keyB64), null);
console.log("all unsubscribe signing tests passed");
