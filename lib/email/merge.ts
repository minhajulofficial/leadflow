/** Merge fields for campaign subject/body: {{name}}, {{company}}, {{city}}, ... */
import type { LeadInput } from "../leads";

export const MERGE_FIELDS = [
  "name", "company", "city", "country", "role", "niche", "website", "phone", "email",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

const FIELD_RE = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Fields used in a template (lower-cased, in order of appearance). */
export function extractMergeFields(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(FIELD_RE)) {
    const f = m[1].toLowerCase();
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** Unknown {{fields}} in a template — the author must fix these before sending. */
export function unknownMergeFields(template: string): string[] {
  return extractMergeFields(template).filter((f) => !(MERGE_FIELDS as readonly string[]).includes(f));
}

/**
 * Replace {{fields}} with the lead's values. Unknown fields become "".
 * With escape=true (HTML body) values are HTML-escaped so a lead's data
 * can never break the markup or inject HTML; subjects/plain text use escape=false.
 */
export function applyMerge(template: string, lead: LeadInput, escape = false): string {
  return template.replace(FIELD_RE, (_, raw: string) => {
    const f = raw.toLowerCase() as MergeField;
    const v = (lead as Record<string, unknown>)[f];
    const s = v == null ? "" : String(v);
    return escape ? escapeHtml(s) : s;
  });
}
