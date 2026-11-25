import { createClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/email/events";
import { json, sameOriginJson } from "@/lib/http";

/**
 * Per-recipient actions (signed in only). Today: mark a recipient as replied
 * by hand — the fallback until Resend inbound is configured for automatic
 * reply detection (see app/api/email/webhooks/resend-inbound).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { id } = await ctx.params;
  const b: any = await req.json().catch(() => null);
  if (b?.action !== "mark-replied") return json({ error: "Unknown action." }, 400);
  const { data: rec } = await supabase.from("campaign_recipients")
    .select("id, campaign_id, user_id, status").eq("id", id).maybeSingle();
  if (!rec) return json({ error: "Recipient not found." }, 404);
  if (rec.status !== "sent") return json({ error: "Only a sent email can be marked replied." }, 400);
  await recordEvent(supabase, {
    recipientId: rec.id, campaignId: rec.campaign_id, userId: rec.user_id,
    type: "replied", meta: { manual: true },
  });
  await supabase.from("campaign_recipients").update({ replied_at: new Date().toISOString() })
    .eq("id", rec.id).is("replied_at", null);
  return json({ ok: true });
}
