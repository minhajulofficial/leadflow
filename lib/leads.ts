export const FIELDS = [
  "name","role","company","email","phone","website","address",
  "city","country","facebook","instagram","linkedin","niche",
] as const;
export type Field = (typeof FIELDS)[number];
export type LeadInput = Partial<Record<Field, string>> & { rating?: number | null; reviews?: number | null };
export type Rules = { requireEmail: boolean; requirePhone: boolean; requireWebsite: boolean };

const ALIASES: Record<Field, string[]> = {
  name: ["name", "full name", "contact", "contact name", "business name", "title"],
  role: ["role", "job title", "position", "designation"],
  company: ["company", "organization", "organisation", "business"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "phone number", "mobile", "tel", "telephone", "whatsapp"],
  website: ["website", "url", "site", "web", "domain"],
  address: ["address", "street", "location"],
  city: ["city", "town"],
  country: ["country", "nation"],
  facebook: ["facebook", "fb", "facebook url"],
  instagram: ["instagram", "insta", "ig", "instagram url"],
  linkedin: ["linkedin", "linkedin url"],
  niche: ["niche", "category", "industry", "type"],
};

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Map a CSV row with unknown header names onto our field names. */
export function mapRow(raw: Record<string, unknown>): Record<string, string> {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) norm[k.trim().toLowerCase()] = String(v ?? "").trim();
  const out: Record<string, string> = {};
  for (const f of FIELDS) {
    const hit = ALIASES[f].find((a) => norm[a]);
    if (hit) out[f] = norm[hit];
  }
  const r = norm["rating"], rv = norm["reviews"] ?? norm["review count"];
  if (r) out.rating = r;
  if (rv) out.reviews = rv;
  return out;
}

/** Clean one lead. Returns the lead, or null plus the reason it was rejected. */
export function cleanLead(
  row: Record<string, string>,
  rules: Rules
): { lead: LeadInput | null; reason?: string } {
  const lead: LeadInput = {};
  for (const f of FIELDS) if (row[f]) lead[f] = row[f].trim();

  if (lead.email) {
    lead.email = lead.email.toLowerCase();
    if (!isEmail(lead.email)) delete lead.email;
  }
  if (lead.phone) {
    const p = lead.phone.replace(/[^\d+]/g, "");
    if (p.replace(/\D/g, "").length >= 7) lead.phone = p; else delete lead.phone;
  }
  if (lead.website) {
    const w = lead.website.replace(/\s/g, "");
    lead.website = /^https?:\/\//i.test(w) ? w : `https://${w}`;
    try { new URL(lead.website); } catch { delete lead.website; }
  }
  const num = (s?: string) => (s && !isNaN(Number(s)) ? Number(s) : null);
  lead.rating = num(row.rating);
  lead.reviews = num(row.reviews);

  if (!lead.name && !lead.email && !lead.phone && !lead.website) return { lead: null, reason: "empty" };
  if (rules.requireEmail && !lead.email) return { lead: null, reason: "no email" };
  if (rules.requirePhone && !lead.phone) return { lead: null, reason: "no phone" };
  if (rules.requireWebsite && !lead.website) return { lead: null, reason: "no website" };
  return { lead };
}

/** CSV export. Cells starting with = + - @ are prefixed to stop spreadsheet formula injection. */
export function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
