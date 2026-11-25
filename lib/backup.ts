/**
 * Backup helpers (Phase 8.2). The export script (scripts/export-backup.mjs)
 * dumps these tables through the Supabase REST API with the service-role key
 * (server-side only, never in the browser). The restore test
 * (tests/db-backup.test.mjs) proves an export round-trips back into the
 * database with identical row counts.
 *
 * Tables are ordered parent-first so a restore that re-inserts in this
 * order respects foreign keys. `plans` is included even though it is seed
 * data — a restore must not lose the plan definitions.
 */
export const BACKUP_TABLES = [
  "profiles",
  "plans",
  "payment_methods",
  "providers",
  "directories",
  "countries",
  "cities",
  "leads",
  "lead_runs",
  "payments",
  "audit_logs",
  "user_provider_settings",
  "sender_accounts",
  "templates",
  "campaigns",
  "campaign_recipients",
  "email_queue",
  "email_events",
  "suppression_list",
  "ai_keys",
] as const;

export type BackupData = Record<string, unknown[]>;

/** Serialize one backup run: { version, exported_at, tables: { name: rows } }. */
export function buildBackupJson(rowsByTable: BackupData, exportedAt = new Date().toISOString()): string {
  const tables: BackupData = {};
  for (const t of BACKUP_TABLES) tables[t] = rowsByTable[t] ?? [];
  return JSON.stringify({ version: 1, exported_at: exportedAt, tables }, null, 2);
}

/** Parse + validate a backup file. Throws on bad shape (never restore blind). */
export function parseBackupJson(text: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("BACKUP_INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("BACKUP_BAD_SHAPE");
  const { version, tables } = parsed as { version?: unknown; tables?: unknown };
  if (version !== 1 || !tables || typeof tables !== "object" || Array.isArray(tables)) {
    throw new Error("BACKUP_BAD_SHAPE");
  }
  const out: BackupData = {};
  for (const [name, rows] of Object.entries(tables as Record<string, unknown>)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) throw new Error(`BACKUP_UNKNOWN_TABLE:${name}`);
    if (!Array.isArray(rows)) throw new Error(`BACKUP_TABLE_NOT_ARRAY:${name}`);
    out[name] = rows;
  }
  return out;
}

/** Row counts per table, for the restore test and the script's summary. */
export function backupCounts(data: BackupData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of BACKUP_TABLES) counts[t] = data[t]?.length ?? 0;
  return counts;
}
