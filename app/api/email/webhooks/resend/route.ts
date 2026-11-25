import { createServiceClient } from "@/lib/supabase/service";
import { verifySvixSignature } from "@/lib/email/webhook";
import { recordEvent } from "@/lib/email/events";
import { json } from "@/lib/http";

/**
 * Resend event webhook (public POST, no login). Resend signs every delivery
 * with Svix — the signature is verified before any row is written, and the
 * route fails closed (401) when RESEND_WEBHOOK_SECRET is not configured.
 *
 * Events handled: email.delivered, email.bounced, email.complained,
 * email.opened, email.clicked. Bounced/complained addresses are added to
 * the owner's suppression list and never emailed again. Replays of the same
 * Svix delivery are stored once (see email_events dedupe index).
 *
 * Set up in Resend: Settings > Webhooks > add endpoint
 *   https://YOUR-DOMAIN/api/email/webhooks/resend
 * and subscribe to the events above. Copy the signing secret into the
 * Cloudflare Secret RESEND_WEBHOOK_SECRET.
 */
const TYPE_MAP: Record<string, { type: "delivered" | "bounced" | "complained" | "opened" | "clicked"; bounce: boolean }> = {
  "email.delivered": { type: "delivered", bounce: false },
  "email.bounced": { type: "bounced", bounce: true },
  "email.complained": { type: "complained", bounce: true },
  "email.opened": { type: "opened", bounce: false },
  "email.clicked": { type: "clicked", bounce: false },
};

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await verifySvixSignature(raw, {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  }, process.env.RESEND_WEBHOOK_SECRET);
  if (!ok) return json({ error: "Bad signature." }, 401);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "Bad JSON." }, 400); }
  const mapped = TYPE_MAP[String(body?.type ?? "")];
  if (!mapped) return json({ ok: true, ignored: true }); // unknown event type: ack, do nothing
  const data = body?.data ?? {};
  const resendId = typeof data.email_id === "string" ? data.email_id : "";
  const svixId = req.headers.get("svix-id") ?? "";
  if (!resendId) return json({ ok: true, matched: false });

  let db: any;
  try { db = createServiceClient(); }
  catch { return json({ error: "Webhook not configured." }, 503); }
  const { data: rec } = await db.from("campaign_recipients")
    .select("id, campaign_id, user_id, email").eq("resend_id", resendId).maybeSingle();
  if (!rec) return json({ ok: true, matched: false });

  await recordEvent(db, {
    recipientId: rec.id, campaignId: rec.campaign_id, userId: rec.user_id,
    type: mapped.type, externalId: svixId || null,
    meta: { to: data.to ?? null, subject: data.subject ?? null },
  });
  if (mapped.type === "bounced") {
    await db.from("campaign_recipients").update({ bounced_at: new Date().toISOString() })
      .eq("id", rec.id).is("bounced_at", null);
  }
  if (mapped.bounce) {
    await db.from("suppression_list").upsert(
      { user_id: rec.user_id, email: String(rec.email).toLowerCase(), reason: mapped.type === "bounced" ? "bounced" : "complaint" },
      { onConflict: "user_id,email_key", ignoreDuplicates: true },
    );
    // stop anything still waiting to go to this address
    const { data: waiting } = await db.from("campaign_recipients").select("id")
      .eq("user_id", rec.user_id).eq("email_key", String(rec.email).toLowerCase()).in("status", ["pending", "queued"]);
    const ids = (waiting ?? []).map((r: any) => r.id);
    if (ids.length) {
      await db.from("campaign_recipients").update({ status: "suppressed" }).in("id", ids);
      await db.from("email_queue").delete().in("recipient_id", ids).eq("status", "queued");
    }
  }
  return json({ ok: true, matched: true });
}
