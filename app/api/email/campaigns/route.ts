import { createClient } from "@/lib/supabase/server";
import { isEmail } from "@/lib/leads";
import { unknownMergeFields } from "@/lib/email/merge";
import { json, sameOriginJson } from "@/lib/http";

/** Own campaigns, newest first, with recipient counts. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(100);
  const ids = (data ?? []).map((c: any) => c.id);
  const counts: Record<string, any> = {};
  if (ids.length) {
    const { data: recs } = await supabase.from("campaign_recipients").select("campaign_id, status").in("campaign_id", ids);
    for (const r of recs ?? []) {
      counts[r.campaign_id] ??= { total: 0, sent: 0, failed: 0, queued: 0 };
      counts[r.campaign_id].total++;
      if (r.status === "sent") counts[r.campaign_id].sent++;
      if (r.status === "failed") counts[r.campaign_id].failed++;
      if (r.status === "queued" || r.status === "sending") counts[r.campaign_id].queued++;
    }
  }
  return json({ campaigns: (data ?? []).map((c: any) => ({ ...c, counts: counts[c.id] ?? { total: 0, sent: 0, failed: 0, queued: 0 } })) });
}

/**
 * Create a draft campaign from chosen leads. Leads without an email are
 * skipped (counted); suppressed addresses are marked 'suppressed' up front
 * and never enqueued. Recipients are deduplicated by (campaign, lead) and
 * (campaign, email) in the database.
 */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const senderId = typeof b?.senderId === "string" ? b.senderId : "";
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 120) : "";
  const subject = typeof b?.subject === "string" ? b.subject.slice(0, 200) : "";
  const body = typeof b?.body === "string" ? b.body.slice(0, 50000) : "";
  const leadIds = Array.isArray(b?.leadIds) ? [...new Set(b.leadIds.filter((x: unknown) => typeof x === "string"))].slice(0, 5000) : [];
  if (!senderId) return json({ error: "Choose a sender first (Email > Senders)." }, 400);
  if (!subject.trim() || !body.trim()) return json({ error: "A campaign needs a subject and a body." }, 400);
  const bad = [...unknownMergeFields(subject), ...unknownMergeFields(body)].filter((v, i, a) => a.indexOf(v) === i);
  if (bad.length) return json({ error: `Unknown merge field(s): ${bad.map((f) => "{{" + f + "}}").join(", ")}` }, 400);
  if (!leadIds.length) return json({ error: "Choose at least one lead to send to." }, 400);

  const { data: sender } = await supabase.from("sender_accounts").select("id, active, has_key").eq("id", senderId).maybeSingle();
  if (!sender?.active || !sender?.has_key) return json({ error: "That sender is not ready. Connect it in Email > Senders." }, 400);
  const { data: leads } = await supabase.from("leads").select("id, name, company, city, country, email").in("id", leadIds);
  const withEmail = (leads ?? []).filter((l: any) => l.email && isEmail(l.email));
  if (!withEmail.length) return json({ error: "None of the chosen leads has a valid email address." }, 400);

  const { data: campaign, error } = await supabase.from("campaigns")
    .insert({ sender_id: senderId, name: name || subject.slice(0, 80), subject, body }).select("id").single();
  if (error || !campaign) return json({ error: "Could not create the campaign." }, 400);

  const { data: sup } = await supabase.from("suppression_list").select("email");
  const suppressed = new Set((sup ?? []).map((s: any) => String(s.email).toLowerCase()));
  const rows = withEmail.map((l: any) => ({
    campaign_id: campaign.id, lead_id: l.id, email: String(l.email).toLowerCase(),
    name: l.name ?? null, company: l.company ?? null, city: l.city ?? null, country: l.country ?? null,
    status: suppressed.has(String(l.email).toLowerCase()) ? "suppressed" : "pending",
  }));
  // insert one by one so a duplicate never blocks the rest (same pattern as lead imports)
  let added = 0, skippedSuppressed = 0;
  for (const r of rows) {
    const { error: e } = await supabase.from("campaign_recipients").insert(r);
    if (!e) { added++; if (r.status === "suppressed") skippedSuppressed++; }
  }
  return json({
    ok: true, id: campaign.id, added,
    skippedNoEmail: (leads ?? []).length - withEmail.length,
    skippedSuppressed,
  });
}
