import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { resendMessage, sendResend } from "@/lib/email/resend";
import { applyMerge } from "@/lib/email/merge";
import { signUnsubscribe } from "@/lib/email/unsubscribe";
import { isEmail } from "@/lib/leads";
import { json, sameOriginJson } from "@/lib/http";

/**
 * Campaign actions: send / schedule / pause / resume / test.
 * Sending only flips the campaign to 'sending' and enqueues recipients
 * (enqueue_campaign RPC, exactly once); the queue worker does the delivery,
 * so closing the tab never loses a send.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { id } = await ctx.params;
  const b: any = await req.json().catch(() => null);
  const action = b?.action;
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) return json({ error: "Campaign not found." }, 404);

  if (action === "test") {
    if (!campaign.sender_id) return json({ error: "Choose a sender first." }, 400);
    const to = typeof b?.to === "string" && isEmail(b.to) ? b.to : user.email;
    if (!to) return json({ error: "No address to send the test to." }, 400);
    const { data: sender } = await supabase.from("sender_accounts")
      .select("id, from_email, from_name, active, has_key").eq("id", campaign.sender_id).maybeSingle();
    if (!sender?.active || !sender?.has_key) return json({ error: "That sender is not ready." }, 400);
    const { data: enc } = await supabase.rpc("get_sender_key", { p_id: sender.id });
    if (!enc) return json({ error: "Could not read the sender key. Save it again in Email > Senders." }, 500);
    let apiKey: string;
    try { apiKey = await decryptSecret(enc, process.env.ENCRYPTION_KEY); }
    catch { return json({ error: "Could not read the sender key. Save it again in Email > Senders." }, 500); }
    const sample = { name: user.email?.split("@")[0] ?? "there", company: "Your company", city: "Dhaka", country: "Bangladesh" };
    const unsub = `${new URL(req.url).origin}/api/email/unsubscribe?token=${await signUnsubscribe(user.id, to, process.env.ENCRYPTION_KEY)}`;
    try {
      await sendResend(apiKey, {
        from: sender.from_name ? `${sender.from_name} <${sender.from_email}>` : sender.from_email,
        to, subject: `[Test] ${applyMerge(campaign.subject, sample)}`,
        html: `${applyMerge(campaign.body, sample, true)}<p style="color:#888;font-size:12px">Test email from LeadFlow. <a href="${unsub}">Unsubscribe</a></p>`,
        text: `${applyMerge(campaign.body, sample)}\n\nUnsubscribe: ${unsub}`,
      });
    } catch (e) { return json({ error: resendMessage(e) }, 400); }
    return json({ ok: true, to }); // test sends never count toward the daily limit
  }

  if (action === "pause") {
    if (!["sending", "scheduled"].includes(campaign.status)) return json({ error: "Only a sending or scheduled campaign can be paused." }, 400);
    await supabase.from("campaigns").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: true, status: "paused" });
  }

  if (action === "resume") {
    if (campaign.status !== "paused") return json({ error: "Only a paused campaign can be resumed." }, 400);
    await supabase.from("campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", id);
    const { data } = await supabase.rpc("enqueue_campaign", { p_campaign: id });
    return json({ ok: true, status: "sending", queued: data?.[0]?.queued ?? 0 });
  }

  if (action === "schedule") {
    if (campaign.status !== "draft") return json({ error: "Only a draft can be scheduled." }, 400);
    const at = new Date(b?.scheduledAt ?? "");
    if (isNaN(at.getTime()) || at.getTime() <= Date.now()) return json({ error: "Pick a future date and time." }, 400);
    await supabase.from("campaigns")
      .update({ status: "scheduled", scheduled_at: at.toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: true, status: "scheduled" });
  }

  if (action === "send") {
    if (!["draft", "scheduled", "paused"].includes(campaign.status))
      return json({ error: "This campaign cannot be sent (it is already sending or sent)." }, 400);
    const { data: sender } = campaign.sender_id
      ? await supabase.from("sender_accounts").select("id, active, has_key").eq("id", campaign.sender_id).maybeSingle()
      : { data: null };
    if (!sender?.active || !sender?.has_key) return json({ error: "That sender is not ready. Connect it in Email > Senders." }, 400);
    const { data: usageRows } = await supabase.rpc("my_email_usage");
    const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
    const { count: pending } = await supabase.from("campaign_recipients")
      .select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending");
    if (!pending) return json({ error: "No recipients left to send to." }, 400);
    if (usage && usage.lim != null && usage.sent_today + (pending ?? 0) > usage.lim)
      return json({ error: `Daily limit: you can send ${Math.max(0, usage.lim - usage.sent_today)} more today on your plan.` }, 400);
    await supabase.from("campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", id);
    const { data, error } = await supabase.rpc("enqueue_campaign", { p_campaign: id });
    if (error) return json({ error: "Could not queue this campaign." }, 400);
    return json({ ok: true, status: "sending", queued: data?.[0]?.queued ?? 0, skippedSuppressed: data?.[0]?.skipped_suppressed ?? 0 });
  }

  return json({ error: "Unknown action." }, 400);
}
