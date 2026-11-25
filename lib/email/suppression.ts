/** Suppression: addresses that must never be emailed again. Pure helpers; the
 *  rows themselves live in public.suppression_list (see 0007_email.sql). */

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type SuppressedRow = { email: string; reason?: string };

export function isSuppressed(email: string, list: SuppressedRow[]): boolean {
  const key = normalizeEmail(email);
  return list.some((r) => normalizeEmail(r.email) === key);
}

/** Split a recipient list into mailable vs suppressed (suppressed are never enqueued). */
export function splitMailable<T extends { email: string }>(
  rows: T[], list: SuppressedRow[],
): { ok: T[]; suppressed: T[] } {
  const ok: T[] = [], suppressed: T[] = [];
  for (const r of rows) (isSuppressed(r.email, list) ? suppressed : ok).push(r);
  return { ok, suppressed };
}
