import { createServiceClient } from "@/lib/supabase/service";
import { decodeClickTarget, verifyTracking } from "@/lib/email/tracking";
import { recordEvent } from "@/lib/email/events";

/**
 * Click redirect (public GET, no login). Verifies the signed token, records
 * the click, then 302s to the original link. Only http(s) targets are
 * allowed, and the token binds the click to one recipient — the route cannot
 * be used as an open redirect without a valid token.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const target = decodeClickTarget(url.searchParams.get("u") ?? "");
  const v = await verifyTracking(token, process.env.ENCRYPTION_KEY);
  if (!v || !target) {
    return new Response("This link is not valid.", { status: 400, headers: { "content-type": "text/plain" } });
  }
  let db: any;
  try { db = createServiceClient(); } catch { /* still redirect below */ }
  if (db) {
    const { data: rec } = await db.from("campaign_recipients").select("id, campaign_id, user_id")
      .eq("id", v.recipientId).eq("user_id", v.userId).maybeSingle();
    if (rec) {
      await recordEvent(db, {
        recipientId: rec.id, campaignId: rec.campaign_id, userId: rec.user_id,
        type: "clicked", targetUrl: target,
      });
      await db.from("campaign_recipients").update({ clicked_at: new Date().toISOString() })
        .eq("id", rec.id).is("clicked_at", null);
    }
  }
  return Response.redirect(target, 302);
}
