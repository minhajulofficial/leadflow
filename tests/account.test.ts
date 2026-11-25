import assert from "node:assert/strict";
import {
  ACCOUNT_DELETE_TABLES,
  ACCOUNT_RETAINED_TABLES,
  stripExportSecrets,
  buildAccountExport,
  deletedPlaceholderEmail,
  DELETE_CONFIRM_WORD,
} from "@/lib/account";

let n = 0;
const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- delete order: children first, profile last (foreign keys never block) ---
const idx = (t: string) => (ACCOUNT_DELETE_TABLES as readonly string[]).indexOf(t);
assert.ok(idx("email_queue") < idx("campaign_recipients"));
assert.ok(idx("email_events") < idx("campaign_recipients"));
assert.ok(idx("campaign_recipients") < idx("campaigns"));
assert.ok(idx("campaigns") >= 0 && idx("sender_accounts") >= 0, "campaigns and senders are both deleted");
assert.ok(idx("profiles") === ACCOUNT_DELETE_TABLES.length - 1, "profile is deleted last");
for (const t of ["leads", "lead_runs", "user_provider_settings", "ai_keys", "suppression_list", "templates"]) {
  assert.ok(idx(t) >= 0, `${t} missing from the delete list`);
}
ok("delete list covers every user-owned table, children first, profile last");

// --- payments + audit log are retained, everything else is deleted ---
assert.deepEqual([...ACCOUNT_RETAINED_TABLES].sort(), ["audit_logs", "payments"]);
assert.ok(!ACCOUNT_DELETE_TABLES.includes("payments" as never), "payments are not deleted");
assert.ok(!ACCOUNT_DELETE_TABLES.includes("audit_logs" as never), "audit log is not deleted");
ok("payments and audit log are retained (refund window + deletion record)");

// --- the confirmation word is exact ---
assert.equal(DELETE_CONFIRM_WORD, "DELETE");
ok("deletion requires typing DELETE");

// --- export strips encrypted credentials, keeps everything else ---
const row = { id: "s1", provider: "resend", name: "Main", api_key_enc: "v1.secret", has_key: true };
const stripped = stripExportSecrets(row);
assert.equal(stripped.api_key_enc, undefined);
assert.equal(stripped.name, "Main");
assert.equal(stripped.has_key, true);
assert.equal(row.api_key_enc, "v1.secret", "input row is not mutated");
ok("export strips api_key_enc and never mutates the input");

// --- export payload strips secrets in every section ---
const file = buildAccountExport(
  { id: "u1", email: "a@x.com" },
  {
    sender_accounts: [{ id: "s1", api_key_enc: "v1.secret", name: "Main" }],
    ai_keys: [{ id: "k1", provider: "gemini", api_key_enc: "v1.secret2" }],
    leads: [{ id: "l1", email: "b@x.com" }],
  },
);
const text = JSON.stringify(file);
assert.ok(!text.includes("v1.secret"), "no ciphertext in the export file");
assert.ok(text.includes("a@x.com") && text.includes("b@x.com"));
assert.equal((file as { product: string }).product, "LeadFlow");
ok("export file contains the user's data and no ciphertext");

// --- deleted placeholder email frees the real address ---
assert.equal(deletedPlaceholderEmail("12345678-aaaa-bbbb-cccc-dddddddddddd"), "deleted-12345678@deleted.invalid");
assert.notEqual(deletedPlaceholderEmail("aaaaaaaa-0000-0000-0000-000000000000"), deletedPlaceholderEmail("bbbbbbbb-0000-0000-0000-000000000000"));
ok("anonymised placeholder email is per-user and frees the real address");

console.log(`ALL ${n} ACCOUNT TESTS PASSED`);
