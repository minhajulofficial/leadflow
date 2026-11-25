/**
 * Account export + deletion (Phase 8.5, PRD NFR-L4).
 *
 * DELETED (in this order — children first, so foreign keys never block):
 * email_queue, email_events, campaign_recipients, campaigns, templates,
 * sender_accounts, suppression_list, ai_keys, lead_runs, leads,
 * user_provider_settings, then the profile row.
 *
 * RETAINED on purpose: payments + audit_logs. A deleted account may still
 * be inside its refund window, and the payment record (TrxID, amount,
 * decision) is the only proof of what was paid. The audit log keeps the
 * deletion itself recorded. Both rows keep only the user id — no name,
 * email or phone survives in them after the profile is anonymised.
 *
 * The login itself is NOT removed from Supabase Auth: every user table
 * references auth.users(id) ON DELETE CASCADE, so deleting the auth user
 * would wipe the retained payment rows too. Instead the auth user is
 * anonymised (email replaced with a deleted placeholder) and permanently
 * banned, so the original email address can sign up fresh later.
 *
 * Last-admin rule: an admin cannot delete their own account while they are
 * the only admin. A second admin must exist first.
 */
export const ACCOUNT_DELETE_TABLES = [
  "email_queue",
  "email_events",
  "campaign_recipients",
  "campaigns",
  "templates",
  "sender_accounts",
  "suppression_list",
  "ai_keys",
  "lead_runs",
  "leads",
  "user_provider_settings",
  "profiles",
] as const;

export const ACCOUNT_RETAINED_TABLES = ["payments", "audit_logs"] as const;

/** Columns that must never appear in an export (encrypted credentials). */
export const EXPORT_SECRET_COLUMNS = ["api_key_enc"] as const;

export type ExportRow = Record<string, unknown>;

/** Strip secret columns from one exported row (never mutate the input). */
export function stripExportSecrets(row: ExportRow): ExportRow {
  const out: ExportRow = {};
  for (const [k, v] of Object.entries(row)) {
    if ((EXPORT_SECRET_COLUMNS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/** The typed confirmation the delete UI and API both require. */
export const DELETE_CONFIRM_WORD = "DELETE";

/** Placeholder email an anonymised auth user gets (frees the real address). */
export function deletedPlaceholderEmail(userId: string): string {
  return `deleted-${userId.slice(0, 8)}@deleted.invalid`;
}

/** Assemble the downloadable export file (one JSON object, sections by table). */
export function buildAccountExport(
  user: { id: string; email?: string | null },
  sections: Record<string, ExportRow[]>,
  exportedAt = new Date().toISOString(),
): Record<string, unknown> {
  const cleaned: Record<string, ExportRow[]> = {};
  for (const [table, rows] of Object.entries(sections)) {
    cleaned[table] = rows.map(stripExportSecrets);
  }
  return {
    product: "LeadFlow",
    version: 1,
    exported_at: exportedAt,
    user: { id: user.id, email: user.email ?? null },
    note: "Encrypted provider keys are never included in an export. Payment records are included; the audit log is not (it belongs to the service, not the account).",
    data: cleaned,
  };
}
