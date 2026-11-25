import { createClient } from "@/lib/supabase/server";
import { unknownMergeFields } from "@/lib/email/merge";
import { json, sameOriginJson } from "@/lib/http";

/** One campaign with its recipients (newest activity first). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { id } = await ctx.params;
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) return json({ error: "Campaign not found." }, 404);
  const { data: recipients } = await supabase.from("campaign_recipients")
    .select("id, email, name, company, status, attempts, last_error, sent_at, created_at")
    .eq("campaign_id", id).order("created_at").limit(500);
  const { data: sender } = campaign.sender_id
    ? await supabase.from("sender_accounts").select("id, name, from_email, active").eq("id", campaign.sender_id).maybeSingle()
    : { data: null };
  const { data: usageRows } = await supabase.rpc("my_email_usage");
  const usage = Array.isArray(usageRows) ? usageRows[0] ?? null : usageRows ?? null;
  return json({ campaign, sender: sender ?? null, recipients: recipients ?? [], usage });
}

/** Edit a draft (subject/body/name/sender), or rename a scheduled one. Sent campaigns are history: not editable. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { id } = await ctx.params;
  const b: any = await req.json().catch(() => null);
  const { data: campaign } = await supabase.from("campaigns").select("status").eq("id", id).maybeSingle();
  if (!campaign) return json({ error: "Campaign not found." }, 404);
  if (campaign.status !== "draft" && campaign.status !== "scheduled")
    return json({ error: "Only draft or scheduled campaigns can be edited." }, 400);
  const patch: Record<string, unknown> = {};
  if (typeof b?.name === "string") patch.name = b.name.trim().slice(0, 120);
  if (typeof b?.subject === "string") patch.subject = b.subject.slice(0, 200);
  if (typeof b?.body === "string") patch.body = b.body.slice(0, 50000);
  if (typeof b?.senderId === "string") patch.sender_id = b.senderId;
  if (typeof b?.scheduledAt === "string") patch.scheduled_at = b.scheduledAt;
  if (patch.subject !== undefined && !String(patch.subject).trim()) return json({ error: "Subject cannot be empty." }, 400);
  const bad = [...unknownMergeFields(String(patch.subject ?? "")), ...unknownMergeFields(String(patch.body ?? ""))]
    .filter((v, i, a) => a.indexOf(v) === i);
  if (bad.length) return json({ error: `Unknown merge field(s): ${bad.map((f) => "{{" + f + "}}").join(", ")}` }, 400);
  const { error } = await supabase.from("campaigns").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return json({ error: "Could not update the campaign." }, 400);
  return json({ ok: true });
}

/** Delete a draft, scheduled or paused campaign (with its recipients). Sent campaigns stay as history. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { id } = await ctx.params;
  const { data: campaign } = await supabase.from("campaigns").select("status").eq("id", id).maybeSingle();
  if (!campaign) return json({ error: "Campaign not found." }, 404);
  if (!["draft", "scheduled", "paused"].includes(campaign.status))
    return json({ error: "Only draft, scheduled or paused campaigns can be deleted." }, 400);
  await supabase.from("campaigns").delete().eq("id", id);
  return json({ ok: true });
}
