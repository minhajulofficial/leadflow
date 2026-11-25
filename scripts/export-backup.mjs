#!/usr/bin/env node
/**
 * LeadFlow backup export (Phase 8.2) — SERVER-SIDE ONLY.
 *
 * Dumps every table in lib/backup.ts BACKUP_TABLES through the Supabase
 * REST API with the service-role key, into backups/<timestamp>/ as one
 * JSON file per table plus a manifest. Never run this in the browser and
 * never commit its output (it contains user data).
 *
 * Usage:
 *   SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY \
 *   node scripts/export-backup.mjs [output-dir]
 *
 * (SUPABASE_URL may also be given as NEXT_PUBLIC_SUPABASE_URL.)
 * Restore: see SETUP.md "Backups & restore" — re-insert each table's rows
 * in BACKUP_TABLES order, then run tests/db-backup.test.mjs to verify the
 * round-trip on a fixture before touching production.
 */
import fs from "node:fs";
import path from "node:path";

const BACKUP_TABLES = [
  "profiles", "plans", "payment_methods", "providers", "directories",
  "countries", "cities", "leads", "lead_runs", "payments", "audit_logs",
  "user_provider_settings", "sender_accounts", "templates", "campaigns",
  "campaign_recipients", "email_queue", "email_events", "suppression_list",
  "ai_keys",
];

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first. See SETUP.md.");
  process.exit(1);
}

const outDir = path.resolve(process.argv[2] ?? `backups/${new Date().toISOString().replace(/[:.]/g, "-")}`);
fs.mkdirSync(outDir, { recursive: true });

const counts = {};
for (const table of BACKUP_TABLES) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(`Failed to export ${table}: HTTP ${res.status}`);
      process.exit(1);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
  counts[table] = rows.length;
  console.log(`${table}: ${rows.length} rows`);
}

const manifest = { version: 1, exported_at: new Date().toISOString(), tables: counts };
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Backup written to ${outDir}`);
