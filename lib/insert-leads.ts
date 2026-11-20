import type { LeadInput } from "./leads";

/** Insert in chunks; if a chunk fails fall back to row-by-row so one duplicate never blocks the rest. */
export async function insertLeads(supabase: any, leads: LeadInput[], source: "manual" | "csv" | "auto" | "extension") {
  let added = 0, dup = 0, limitHit = false;
  const payload = leads.map((l) => ({ ...l, source }));
  for (let i = 0; i < payload.length && !limitHit; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await supabase.from("leads").insert(chunk);
    if (!error) { added += chunk.length; continue; }
    for (const row of chunk) {
      const { error: e } = await supabase.from("leads").insert(row);
      if (!e) added++;
      else if (e.message?.includes("PLAN_LIMIT")) { limitHit = true; break; }
      else dup++;
    }
  }
  return { added, dup, limitHit };
}
