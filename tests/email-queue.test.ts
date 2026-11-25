import { backoffMinutes, canSendToday, remainingToday, pickSender, MAX_ATTEMPTS, type SenderPick } from "../lib/email/queue";
import assert from "node:assert/strict";

// retry backoff: 5, 10, 20, 40, then capped at 60 minutes
assert.equal(backoffMinutes(1), 5);
assert.equal(backoffMinutes(2), 10);
assert.equal(backoffMinutes(3), 20);
assert.equal(backoffMinutes(9), 60);
assert.equal(MAX_ATTEMPTS, 3);

// daily caps
assert.equal(canSendToday(0, 20), true);
assert.equal(canSendToday(19, 20), true);
assert.equal(canSendToday(20, 20), false);
assert.equal(canSendToday(999, null), true); // no cap known -> allowed
assert.equal(remainingToday(7, 20), 13);
assert.equal(remainingToday(20, 20), 0);
assert.equal(remainingToday(5, null), null);

// rotation: oldest-used sender wins; capped / inactive senders are skipped
const s = (id: string, last: string | null, active = true, daily_limit: number | null = null): SenderPick =>
  ({ id, provider: "resend", active, daily_limit, last_used_at: last });
const senders = [s("a", "2026-11-25T10:00:00Z"), s("b", null), s("c", "2026-11-25T09:00:00Z")];
assert.equal(pickSender(senders, {}, 20)?.id, "b"); // never used first
assert.equal(pickSender([s("a", "2026-11-25T10:00:00Z"), s("c", "2026-11-25T09:00:00Z")], {}, 20)?.id, "c");
assert.equal(pickSender(senders, { b: 20, c: 20 }, 20)?.id, "a"); // b and c at plan cap
assert.equal(pickSender([s("a", null, true, 5)], { a: 5 }, 20), null); // per-sender cap hit
assert.equal(pickSender([s("a", null, false)], {}, 20), null); // inactive
assert.equal(pickSender([], {}, 20), null);
console.log("all email queue logic tests passed");
