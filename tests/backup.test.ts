import assert from "node:assert/strict";
import { BACKUP_TABLES, buildBackupJson, parseBackupJson, backupCounts } from "@/lib/backup";

let n = 0;
const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- every table the app owns is in the backup list ---
for (const t of ["leads", "campaigns", "campaign_recipients", "email_events", "payments", "profiles", "ai_keys", "audit_logs"]) {
  assert.ok((BACKUP_TABLES as readonly string[]).includes(t), `${t} missing from BACKUP_TABLES`);
}
ok("backup list covers leads, campaigns, events, payments, profiles, ai_keys, audit log");

// --- parents come before children (restore order respects foreign keys) ---
const idx = (t: string) => (BACKUP_TABLES as readonly string[]).indexOf(t);
assert.ok(idx("campaigns") < idx("campaign_recipients"));
assert.ok(idx("campaign_recipients") < idx("email_queue"));
assert.ok(idx("campaign_recipients") < idx("email_events"));
assert.ok(idx("profiles") < idx("leads"));
ok("backup order is parent-first");

// --- round-trip: build -> parse gives the same rows back ---
const rows = {
  leads: [{ id: "l1", email: "a@x.com" }, { id: "l2", email: "b@x.com" }],
  campaigns: [{ id: "c1", subject: "Hi" }],
};
const parsed = parseBackupJson(buildBackupJson(rows, "2026-11-25T00:00:00.000Z"));
assert.deepEqual(parsed.leads, rows.leads);
assert.deepEqual(parsed.campaigns, rows.campaigns);
assert.deepEqual(parsed.payments, []); // tables with no rows come back as empty arrays
ok("backup JSON round-trips");

// --- counts helper ---
assert.deepEqual(backupCounts(parsed), { ...Object.fromEntries(BACKUP_TABLES.map((t) => [t, 0])), leads: 2, campaigns: 1 });
ok("row counts per table are reported");

// --- bad input never parses into a restorable shape ---
assert.throws(() => parseBackupJson("not json"), /BACKUP_INVALID_JSON/);
assert.throws(() => parseBackupJson("[]"), /BACKUP_BAD_SHAPE/);
assert.throws(() => parseBackupJson(JSON.stringify({ version: 2, tables: {} })), /BACKUP_BAD_SHAPE/);
assert.throws(() => parseBackupJson(JSON.stringify({ version: 1, tables: { leads: "nope" } })), /BACKUP_TABLE_NOT_ARRAY/);
assert.throws(() => parseBackupJson(JSON.stringify({ version: 1, tables: { evil_table: [] } })), /BACKUP_UNKNOWN_TABLE/);
ok("invalid backup files are rejected, never restored blind");

console.log(`ALL ${n} BACKUP TESTS PASSED`);
