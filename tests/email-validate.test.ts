import assert from "node:assert/strict";
import { validateEmailSyntax, validateEmail, validateEmailDomains, type MxResult } from "@/lib/email/validate";

let n = 0; const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- syntax ---
assert.equal(validateEmailSyntax("lead@acme.com"), true);
assert.equal(validateEmailSyntax("First.Last+tag@sub.example.co.uk"), true);
assert.equal(validateEmailSyntax("not-an-email"), false);
assert.equal(validateEmailSyntax("no-domain@"), false);
assert.equal(validateEmailSyntax("@no-local.com"), false);
assert.equal(validateEmailSyntax("two@@x.com"), false);
ok("syntax accepts good addresses and rejects bad ones");

// --- MX via mocked DNS-over-HTTPS (fetch passed in, no network) ---
const mxByDomain: Record<string, MxResult> = { "acme.com": "ok", "dead.invalid": "none" };
const mockFetch = (async (url: string) => {
  const u = new URL(url);
  const name = u.searchParams.get("name") ?? "";
  if (name === "flaky.example") throw new Error("dns down");
  const mx = mxByDomain[name];
  return {
    ok: true,
    json: async () => (mx === "ok"
      ? { Status: 0, Answer: [{ type: 15, data: "10 mail.acme.com." }] }
      : { Status: 0, Answer: [] }),
  } as any;
}) as any;

const good = await validateEmail("good@acme.com", mockFetch);
assert.deepEqual([good.valid, good.mx], [true, "ok"]); ok("MX ok -> valid");
const bad = await validateEmail("bad@dead.invalid", mockFetch);
assert.equal(bad.valid, false); assert.match(bad.reason ?? "", /no mail server/); ok("MX none -> invalid, reason names the problem");
const flaky = await validateEmail("maybe@flaky.example", mockFetch);
assert.deepEqual([flaky.valid, flaky.mx], [true, "unknown"]); ok("lookup failure -> valid (fail-open, never blocks a send)");
const syntax = await validateEmail("not-an-email", mockFetch);
assert.deepEqual([syntax.valid, syntax.syntax], [false, false]); ok("bad syntax -> invalid without any DNS lookup");

const domains = await validateEmailDomains(["a@acme.com", "b@acme.com", "c@dead.invalid"], mockFetch);
assert.equal(domains.get("acme.com"), "ok"); assert.equal(domains.get("dead.invalid"), "none");
assert.equal(domains.size, 2); ok("domain lookup is deduped per domain (one result per domain)");

console.log(`\nALL ${n} EMAIL VALIDATION TESTS PASSED`);
