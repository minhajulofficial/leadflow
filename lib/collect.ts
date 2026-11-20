import { cleanLead, type LeadInput, type Rules } from "./leads";

export type StartBody = {
  providerSlug: string; directoryId: string; niches: string[]; countryCode: string; cityIds: string[];
  max: number; rules: Rules; minRating: number | null; minReviews: number | null; maxReviews: number | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseNiches = (s: string | string[]): string[] =>
  [...new Set((Array.isArray(s) ? s : s.split(/[,\n]/)).map((x) => String(x).trim()).filter(Boolean))].slice(0, 5);

const numOrNull = (v: unknown, min: number, max: number): number | null | "bad" => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : "bad";
};

/** Validate what the browser sent. Never trust it. */
export function validateStart(b: any, maxPerRun: number): { ok: true; value: StartBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Invalid request." };
  if (typeof b.providerSlug !== "string" || b.providerSlug.length > 60) return { ok: false, error: "Choose a provider." };
  if (typeof b.directoryId !== "string" || !UUID.test(b.directoryId)) return { ok: false, error: "Choose a directory." };
  const niches = parseNiches(Array.isArray(b.niches) ? b.niches : []);
  if (!niches.length) return { ok: false, error: "Enter at least one niche (e.g. dentist)." };
  if (niches.some((n) => n.length > 60)) return { ok: false, error: "Each niche must be under 60 characters." };
  if (typeof b.countryCode !== "string" || !/^[a-z]{2}$/i.test(b.countryCode)) return { ok: false, error: "Choose a country." };
  if (!Array.isArray(b.cityIds) || !b.cityIds.length || b.cityIds.length > 5 || !b.cityIds.every((c: unknown) => typeof c === "string" && UUID.test(c)))
    return { ok: false, error: "Choose 1 to 5 cities." };
  const max = Number(b.max);
  if (!Number.isInteger(max) || max < 1) return { ok: false, error: "Enter how many leads you want per city." };
  if (max > maxPerRun) return { ok: false, error: `Your plan allows up to ${maxPerRun} results per run. Upgrade to Pro for more.` };
  const minRating = numOrNull(b.minRating, 0, 5), minReviews = numOrNull(b.minReviews, 0, 1e7), maxReviews = numOrNull(b.maxReviews, 0, 1e7);
  if (minRating === "bad" || minReviews === "bad" || maxReviews === "bad") return { ok: false, error: "Check the rating/review filters." };
  if (minReviews !== null && maxReviews !== null && minReviews > maxReviews) return { ok: false, error: "Min reviews is bigger than max reviews." };
  const r = b.rules ?? {};
  return { ok: true, value: {
    providerSlug: b.providerSlug, directoryId: b.directoryId, niches, countryCode: b.countryCode.toLowerCase(), cityIds: [...new Set<string>(b.cityIds)],
    max, rules: { requireEmail: r.requireEmail === true, requirePhone: r.requirePhone === true, requireWebsite: r.requireWebsite === true },
    minRating, minReviews, maxReviews } };
}

/** Input for the compass/crawler-google-places actor. */
export function buildApifyInput(p: { niches: string[]; city: string; country: string; countryCode: string; max: number }) {
  return {
    searchStringsArray: p.niches,
    locationQuery: `${p.city}, ${p.country}`,
    maxCrawledPlacesPerSearch: Math.max(1, Math.floor(p.max / p.niches.length)),
    language: "en",
    countryCode: p.countryCode.toLowerCase(),
    skipClosedPlaces: true,
  };
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : String(v).trim() || undefined);
const first = (v: unknown) => (Array.isArray(v) ? str(v[0]) : str(v));

export function mapPlace(item: Record<string, any>, ctx: { country: string; city: string }): Record<string, string> {
  const row: Record<string, string | undefined> = {
    name: str(item.title), company: str(item.title),
    phone: str(item.phone) ?? str(item.phoneUnformatted), website: str(item.website), address: str(item.address),
    city: str(item.city) ?? ctx.city, country: ctx.country, niche: str(item.categoryName),
    email: first(item.emails) ?? str(item.email),
    facebook: first(item.facebooks), instagram: first(item.instagrams), linkedin: first(item.linkedIns ?? item.linkedins),
    rating: str(item.totalScore), reviews: str(item.reviewsCount),
  };
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as Record<string, string>;
}

export type Filters = Pick<StartBody, "rules" | "minRating" | "minReviews" | "maxReviews">;

/** Turn raw dataset items into clean leads, applying the user's filters. */
export function processItems(items: unknown[], ctx: { country: string; city: string }, f: Filters, cap: number) {
  const leads: LeadInput[] = []; const filtered: Record<string, number> = {}; let found = 0;
  const drop = (why: string) => { filtered[why] = (filtered[why] ?? 0) + 1; };
  for (const it of items) {
    if (!it || typeof it !== "object" || (it as any).error) continue;
    found++;
    const { lead, reason } = cleanLead(mapPlace(it as Record<string, any>, ctx), f.rules);
    if (!lead) { drop(reason ?? "invalid"); continue; }
    if (f.minRating !== null && (lead.rating == null || lead.rating < f.minRating)) { drop("rating too low"); continue; }
    if (f.minReviews !== null && (lead.reviews == null || lead.reviews < f.minReviews)) { drop("too few reviews"); continue; }
    if (f.maxReviews !== null && lead.reviews != null && lead.reviews > f.maxReviews) { drop("too many reviews"); continue; }
    if (leads.length < cap) leads.push(lead);
  }
  return { leads, found, filtered: Object.values(filtered).reduce((a, b) => a + b, 0), reasons: filtered };
}

export type RunState = "running" | "ready" | "failed";
export const apifyState = (s: string): RunState =>
  s === "SUCCEEDED" ? "ready" : ["FAILED", "ABORTING", "ABORTED", "TIMING-OUT", "TIMED-OUT"].includes(s) ? "failed" : "running";
