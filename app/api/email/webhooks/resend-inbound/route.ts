import { createServiceClient } from "@/lib/supabase/service";
import { extractReplyTargetIds, verifySvixSignature } from "@/lib/email/webhook";
import { recordEvent } from "@/lib/email/events";
import { json } from "@/lib/http";

/**
 * Resend inbound email (public POST, no login) — reply detection.
 *
 * How it works: a reply quotes the original message (In-Reply-To /
 * References headers carry its Message-ID, which Resend builds from the
 * sent email's id). This route extracts those ids, matches one against
 * campaign_recipients.resend_id, and records a 'replied' event.
 *
 * Setup (owner action, Resend dashboard): enable Inbound for the sending
 * domain (MX records point at Resend), then add a webhook endpoint
 *   https://YOUR-DOMAIN/api/email/webhooks/resend-inbound
 * with the same RESEND_WEBHOOK_SECRET. Until that is configured, replies
 * are recorded with the manual "Mark replied" button on a campaign instead
 * (see app/api/email/recipients/[id]).
 */
function headerValue(headers: unknown, name: string): unknown {
  if (!headers || typeof headers !== "object") return undefined;
  const h = headers as Record<string, unknown>;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? h[key] : undefined;
}

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
  if (String(body?.type ?? "") !== "email.received") return json({ ok: true, ignored: true });
  const data = body?.data ?? {};
  const ids = extractReplyTargetIds([
    headerValue(data.headers, "in-reply-to"),
    headerValue(data.headers, "references"),
  ]);
  if (!ids.length) return json({ ok: true, matched: false });

  let db: any;
  try { db = createServiceClient(); }
  catch { return json({ error: "Webhook not configured." }, 503); }
  const { data: rec } = await db.from("campaign_recipients")
    .select("id, campaign_id, user_id").in("resend_id", ids).maybeSingle();
  if (!rec) return json({ ok: true, matched: false });

  await recordEvent(db, {
    recipientId: rec.id, campaignId: rec.campaign_id, userId: rec.user_id,
    type: "replied", externalId: req.headers.get("svix-id") || null,
    meta: { from: data.from ?? null, subject: data.subject ?? null },
  });
  await db.from("campaign_recipients").update({ replied_at: new Date().toISOString() })
    .eq("id", rec.id).is("replied_at", null);
  return json({ ok: true, matched: true });
}
