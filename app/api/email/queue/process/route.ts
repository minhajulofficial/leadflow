import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret } from "@/lib/crypto";
import { resendMessage, sendResend } from "@/lib/email/resend";
import { applyMerge } from "@/lib/email/merge";
import { addTracking } from "@/lib/email/tracking";
import { recordEvent } from "@/lib/email/events";
import { validateEmailDomains, type MxResult } from "@/lib/email/validate";
import { backoffMinutes, canSendToday, CRON_BATCH, MAX_ATTEMPTS, SEND_DELAY_MS, USER_BATCH } from "@/lib/email/queue";
import { signUnsubscribe } from "@/lib/email/unsubscribe";
import { effectivePlan } from "@/lib/plan";
import { isEmail } from "@/lib/leads";
import { json } from "@/lib/http";

/**
 * Queue worker — sends queued campaign emails. Runs with NO browser session.
 *
 * Two modes (same endpoint, POST):
 *  - CRON mode: `Authorization: Bearer <CRON_SECRET>` (Cloudflare Secret).
 *    Uses the server-only service-role client and processes due jobs for ALL
 *    users (batch 50), including promoting due scheduled campaigns.
 *    Configure a 5-minute trigger in Cloudflare (Workers > leadflow >
 *    Settings > Triggers > Cron Triggers) or any external cron / Supabase
 *    pg_cron that POSTs to this URL with the secret. See SETUP.md.
 *  - USER mode ("Send now" button): a signed-in user processes only their
 *    OWN due jobs (batch 10) via the claim_my_email_jobs() RPC.
 *    This is also the live-test path before any cron is configured.
 *
 * Retries: a failed send is re-queued with backoff (5/10/20… min, capped
 * 60 min) and marked failed after MAX_ATTEMPTS tries. Daily caps (plan +
 * per-sender) are enforced here, not just in the UI.
 */

type Job = { id: string; recipient_id: string; campaign_id: string; sender_id: string | null; user_id: string };
type Ctx = {
  db: any; // supabase client (service-role in cron mode, session client in user mode)
  userId: string | null; // null in cron mode (all users)
  getKey: (senderId: string) => Promise<string | null>;
  origin: string;
  mxCache: Map<string, MxResult>; // one MX lookup per domain per worker pass
  keyB64: string | undefined;
};

const todayStart = () => new Date(new Date().toDateString()).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function planLimitFor(db: any, userId: string): Promise<number | null> {
  const { data: p } = await db.from("profiles").select("plan, plan_expires_at").eq("id", userId).maybeSingle();
  if (!p) return null;
  const { data: plan } = await db.from("plans").select("limits").eq("id", effectivePlan(p.plan, p.plan_expires_at)).maybeSingle();
  return plan?.limits?.emails_per_day ?? null;
}

async function sentTodayFor(db: any, userId: string, senderId?: string): Promise<number> {
  let q = db.from("campaign_recipients").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("status", "sent").gte("sent_at", todayStart());
  if (senderId) {
    const { data: camps } = await db.from("campaigns").select("id").eq("sender_id", senderId).eq("user_id", userId);
    const ids = (camps ?? []).map((c: any) => c.id);
    if (!ids.length) return 0;
    q = q.in("campaign_id", ids);
  }
  const { count } = await q;
  return count ?? 0;
}

/** Send one claimed job. Returns 'sent' | 'failed' | 'skipped' | 'requeued'. */
async function processJob(ctx: Ctx, job: Job): Promise<string> {
  const { db } = ctx;
  const { data: rec } = await db.from("campaign_recipients").select("*").eq("id", job.recipient_id).maybeSingle();
  if (!rec) { await db.from("email_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id); return "skipped"; }
  const { data: camp } = await db.from("campaigns").select("*").eq("id", job.campaign_id).maybeSingle();
  if (!camp || camp.status !== "sending") {
    // campaign paused/cancelled mid-flight: park the job, do not send
    await db.from("email_queue").update({ status: "queued", next_try: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    await db.from("campaign_recipients").update({ status: "queued" }).eq("id", rec.id);
    return "requeued";
  }
  const { data: sender } = job.sender_id
    ? await db.from("sender_accounts").select("*").eq("id", job.sender_id).maybeSingle()
    : { data: null };
  if (!sender?.active) {
    await failJob(ctx, job, rec, "Sender is switched off or deleted.");
    return "failed";
  }
  const { data: sup } = await db.from("suppression_list").select("id")
    .eq("user_id", job.user_id).eq("email_key", String(rec.email).toLowerCase()).maybeSingle();
  if (sup) {
    await db.from("campaign_recipients").update({ status: "suppressed" }).eq("id", rec.id);
    await db.from("email_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id);
    return "skipped";
  }
  // Validation safety net (the send action already MX-checked the batch):
  // a bad address never gets sent. MX "unknown" (lookup failed) does NOT
  // block — only a definite "no mail server" does.
  if (!isEmail(String(rec.email))) {
    await db.from("campaign_recipients").update({ status: "skipped", last_error: "Not a valid email address." }).eq("id", rec.id);
    await db.from("email_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id);
    return "skipped";
  }
  const domain = String(rec.email).toLowerCase().split("@").pop() ?? "";
  let mx = ctx.mxCache.get(domain);
  if (mx === undefined) {
    mx = (await validateEmailDomains([String(rec.email)])).get(domain) ?? "unknown";
    ctx.mxCache.set(domain, mx);
  }
  if (mx === "none") {
    await db.from("campaign_recipients").update({ status: "skipped", last_error: `The domain ${domain} has no mail server (no MX records).` }).eq("id", rec.id);
    await db.from("email_queue").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id);
    return "skipped";
  }
  const apiKey = await ctx.getKey(sender.id);
  if (!apiKey) { await failJob(ctx, job, rec, "Could not read the sender key. Save it again in Email > Senders."); return "failed"; }

  const unsub = `${ctx.origin}/api/email/unsubscribe?token=${await signUnsubscribe(job.user_id, rec.email, process.env.ENCRYPTION_KEY)}`;
  const lead = { name: rec.name ?? "", company: rec.company ?? "", city: rec.city ?? "", country: rec.country ?? "", email: rec.email };
  // Open/click tracking (unless the campaign opted out): bare URLs in the
  // body become tracked links and a 1px pixel is appended. Test sends skip
  // tracking (they have no recipient row).
  let html = applyMerge(camp.body, lead, true);
  if (camp.tracking_enabled !== false) {
    html = await addTracking(html, rec.id, job.user_id, ctx.origin, ctx.keyB64);
  }
  try {
    const sent = await sendResend(apiKey, {
      from: sender.from_name ? `${sender.from_name} <${sender.from_email}>` : sender.from_email,
      to: rec.email,
      subject: applyMerge(camp.subject, lead),
      html: `${html}<p style="color:#888;font-size:12px">You are receiving this because you are a business contact of a LeadFlow user. <a href="${unsub}">Unsubscribe</a></p>`,
      text: `${applyMerge(camp.body, lead)}\n\nUnsubscribe: ${unsub}`,
    });
    await db.from("campaign_recipients").update({
      status: "sent", sent_at: new Date().toISOString(), attempts: (rec.attempts ?? 0) + 1,
      resend_id: sent?.id ?? null,
    }).eq("id", rec.id);
    await recordEvent(db, {
      recipientId: rec.id, campaignId: camp.id, userId: job.user_id, type: "sent",
      meta: { resend_id: sent?.id ?? null },
    });
  } catch (e) {
    await failJob(ctx, job, rec, resendMessage(e));
    return "failed";
  }
  await db.from("email_queue").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", job.id);
  await db.from("sender_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", sender.id);
  return "sent";
}

async function failJob(ctx: Ctx, job: Job, rec: any, message: string) {
  const attempts = (rec.attempts ?? 0) + 1;
  const giveUp = attempts >= MAX_ATTEMPTS;
  await ctx.db.from("campaign_recipients").update({
    status: giveUp ? "failed" : "queued", attempts, last_error: message.slice(0, 500),
  }).eq("id", rec.id);
  await ctx.db.from("email_queue").update({
    status: giveUp ? "failed" : "queued",
    attempts,
    next_try: giveUp ? new Date().toISOString() : new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
    last_error: message.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
}

/** Mark campaigns 'sent' when nothing is left to send. */
async function finalizeCampaigns(db: any, campaignIds: string[]) {
  for (const cid of [...new Set(campaignIds)]) {
    const { count } = await db.from("campaign_recipients").select("id", { count: "exact", head: true })
      .eq("campaign_id", cid).in("status", ["pending", "queued", "sending"]);
    if ((count ?? 0) === 0) {
      await db.from("campaigns").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", cid).eq("status", "sending");
    }
  }
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const started = Date.now();
  const result = { processed: 0, sent: 0, failed: 0, skipped: 0, requeued: 0 };

  if (isCron) {
    let db: any;
    try { db = createServiceClient(); }
    catch { return json({ error: "Queue not configured (service-role key missing). Tell the site admin." }, 503); }

    // 1. Promote due scheduled campaigns and enqueue their recipients.
    const { data: due } = await db.from("campaigns").select("id, user_id, sender_id")
      .eq("status", "scheduled").lte("scheduled_at", new Date().toISOString());
    for (const c of due ?? []) {
      await db.from("campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", c.id);
      const { data: recs } = await db.from("campaign_recipients").select("id, email_key").eq("campaign_id", c.id).eq("status", "pending");
      const { data: sup } = await db.from("suppression_list").select("email_key").eq("user_id", c.user_id);
      const supKeys = new Set((sup ?? []).map((s: any) => s.email_key));
      for (const r of recs ?? []) {
        if (supKeys.has(r.email_key)) {
          await db.from("campaign_recipients").update({ status: "suppressed" }).eq("id", r.id);
        } else {
          await db.from("email_queue").insert({ recipient_id: r.id, campaign_id: c.id, user_id: c.user_id, sender_id: c.sender_id });
          await db.from("campaign_recipients").update({ status: "queued" }).eq("id", r.id);
        }
      }
    }

    // 2. Claim due jobs across users (atomic per row: only 'queued' rows flip).
    const { data: dueJobs } = await db.from("email_queue").select("id")
      .eq("status", "queued").lte("next_try", new Date().toISOString())
      .order("created_at", { ascending: true }).limit(CRON_BATCH);
    const ids = (dueJobs ?? []).map((j: any) => j.id);
    if (!ids.length) return json({ ...result, mode: "cron" });
    const { data: jobs } = await db.from("email_queue").update({ status: "sending", claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", ids).eq("status", "queued").select("id, recipient_id, campaign_id, sender_id, user_id");
    const ctx: Ctx = {
      db, userId: null, origin,
      mxCache: new Map(), keyB64: process.env.ENCRYPTION_KEY,
      getKey: async (senderId: string) => {
        const { data: s } = await db.from("sender_accounts").select("api_key_enc").eq("id", senderId).maybeSingle();
        if (!s?.api_key_enc) return null;
        try { return await decryptSecret(s.api_key_enc, process.env.ENCRYPTION_KEY); } catch { return null; }
      },
    };
    const cappedUsers = new Set<string>();
    const sentByUser: Record<string, number> = {};
    const sentBySender: Record<string, number> = {};
    for (const job of (jobs ?? []) as Job[]) {
      if (cappedUsers.has(job.user_id)) continue;
      const lim = await planLimitFor(db, job.user_id);
      const sentU = (sentByUser[job.user_id] ??= await sentTodayFor(db, job.user_id));
      if (!canSendToday(sentU, lim)) { cappedUsers.add(job.user_id); continue; }
      if (job.sender_id) {
        const sentS = (sentBySender[job.sender_id] ??= await sentTodayFor(db, job.user_id, job.sender_id));
        const { data: snd } = await db.from("sender_accounts").select("daily_limit").eq("id", job.sender_id).maybeSingle();
        if (!canSendToday(sentS, snd?.daily_limit ?? lim)) { cappedUsers.add(job.user_id); continue; }
      }
      const out = await processJob(ctx, job);
      result.processed++;
      if (out === "sent") { result.sent++; sentByUser[job.user_id]++; if (job.sender_id) sentBySender[job.sender_id]++; }
      else if (out === "failed") result.failed++;
      else if (out === "skipped") result.skipped++;
      else result.requeued++;
      if (Date.now() - started > 50_000) break; // stay inside the Workers request budget
      await sleep(SEND_DELAY_MS);
    }
    await finalizeCampaigns(db, (jobs ?? []).map((j: any) => j.campaign_id));
    return json({ ...result, mode: "cron" });
  }

  // USER mode: the caller's own jobs only, bounded.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in, or call with the cron secret." }, 401);
  const { data: jobs } = await supabase.rpc("claim_my_email_jobs", { p_limit: USER_BATCH });
  if (!jobs?.length) return json({ ...result, mode: "user" });
  const ctx: Ctx = {
    db: supabase, userId: user.id, origin,
    mxCache: new Map(), keyB64: process.env.ENCRYPTION_KEY,
    getKey: async (senderId: string) => {
      const { data: enc } = await supabase.rpc("get_sender_key", { p_id: senderId });
      if (!enc) return null;
      try { return await decryptSecret(enc, process.env.ENCRYPTION_KEY); } catch { return null; }
    },
  };
  const { data: usageRows } = await supabase.rpc("my_email_usage");
  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  let sentU = usage?.sent_today ?? 0;
  const lim = usage?.lim ?? null;
  for (const job of jobs as Job[]) {
    if (!canSendToday(sentU, lim)) break;
    const out = await processJob(ctx, { ...job, user_id: user.id });
    result.processed++;
    if (out === "sent") { result.sent++; sentU++; }
    else if (out === "failed") result.failed++;
    else if (out === "skipped") result.skipped++;
    else result.requeued++;
    await sleep(SEND_DELAY_MS);
  }
  await finalizeCampaigns(supabase, (jobs as Job[]).map((j) => j.campaign_id));
  return json({ ...result, mode: "user" });
}
