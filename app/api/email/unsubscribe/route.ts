import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";

/**
 * One-click unsubscribe (public link, no login). The signed token proves
 * this address asked to stop; the row is written with the server-only
 * service client because the visitor has no session.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const v = await verifyUnsubscribe(token, process.env.ENCRYPTION_KEY);
  const page = (title: string, text: string) =>
    new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 20px;text-align:center"><h1>${title}</h1><p>${text}</p><p><a href="/">Back to LeadFlow</a></p></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  if (!v) return page("Link not valid", "This unsubscribe link is invalid or expired. Ask the sender to remove you, or contact LeadFlow support.");
  let db: any;
  try { db = createServiceClient(); }
  catch { return page("Try again later", "Unsubscribe is not configured on this server yet. Please try again later."); }
  await db.from("suppression_list").upsert(
    { user_id: v.userId, email: v.email, reason: "unsubscribed" },
    { onConflict: "user_id,email_key" },
  );
  // stop anything still waiting to go to this address
  const { data: recs } = await db.from("campaign_recipients").select("id")
    .eq("user_id", v.userId).eq("email_key", v.email.toLowerCase()).in("status", ["pending", "queued"]);
  const ids = (recs ?? []).map((r: any) => r.id);
  if (ids.length) {
    await db.from("campaign_recipients").update({ status: "suppressed" }).in("id", ids);
    await db.from("email_queue").delete().in("recipient_id", ids).eq("status", "queued");
  }
  return page("You are unsubscribed", `We will not email ${v.email} again from this LeadFlow account.`);
}
