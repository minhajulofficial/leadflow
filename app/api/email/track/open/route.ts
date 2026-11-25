import { createServiceClient } from "@/lib/supabase/service";
import { PIXEL_BYTES, verifyTracking } from "@/lib/email/tracking";
import { EVENT_TO_COLUMN, recordEvent } from "@/lib/email/events";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Open pixel (public GET, no login). The signed token proves this recipient
 * opened the email; the service client writes the event because the visitor
 * has no session. Nothing about the visitor is logged beyond the event row.
 * Rate-limited per IP; on limit the pixel is still served (best-effort
 * tracking must never break the email) but no event is recorded.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const headers = {
    "content-type": "image/gif",
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-length": String(PIXEL_BYTES.length),
  };
  const pixel = () => new Response(PIXEL_BYTES as unknown as BodyInit, { headers });
  const rl = checkRateLimit(rateLimitKey(req, "track-open"), RATE_LIMITS.track);
  if (!rl.ok) return pixel();
  const v = await verifyTracking(token, process.env.ENCRYPTION_KEY);
  if (!v) return pixel();
  let db: any;
  try { db = createServiceClient(); } catch { return pixel(); }
  const { data: rec } = await db.from("campaign_recipients").select("id, campaign_id, user_id")
    .eq("id", v.recipientId).eq("user_id", v.userId).maybeSingle();
  if (!rec) return pixel();
  await recordEvent(db, {
    recipientId: rec.id, campaignId: rec.campaign_id, userId: rec.user_id, type: "opened",
  });
  // first-seen timestamp only — repeat opens still add event rows
  await db.from("campaign_recipients").update({ opened_at: new Date().toISOString() })
    .eq("id", rec.id).is("opened_at", null);
  return pixel();
}
