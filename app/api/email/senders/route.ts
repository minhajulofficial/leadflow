import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { resendMessage, verifyResendKey } from "@/lib/email/resend";
import { isEmail } from "@/lib/leads";
import { json, sameOriginJson } from "@/lib/http";

/** Own sender accounts. The encrypted key is never returned (see the column grant in 0007). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data } = await supabase.from("sender_accounts")
    .select("id, provider, name, from_email, from_name, daily_limit, active, last_used_at, has_key, created_at")
    .order("created_at");
  return json({ senders: data ?? [] });
}

export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const provider = b?.provider === "smtp" ? "smtp" : "resend";
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  const apiKey = typeof b?.apiKey === "string" ? b.apiKey.trim() : "";
  const fromEmail = typeof b?.fromEmail === "string" ? b.fromEmail.trim().toLowerCase() : "";
  const fromName = typeof b?.fromName === "string" ? b.fromName.trim() : "";
  const dailyLimit = b?.dailyLimit == null || b?.dailyLimit === "" ? null : Number(b.dailyLimit);
  if (!name || name.length > 80) return json({ error: "Give this sender a short name." }, 400);
  if (!isEmail(fromEmail)) return json({ error: "Enter a valid sender email address." }, 400);
  if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10000))
    return json({ error: "Daily limit must be between 1 and 10000 (or empty for the plan limit)." }, 400);
  if (apiKey.length < 10 || apiKey.length > 200 || /\s/.test(apiKey)) return json({ error: "That does not look like an API key." }, 400);
  if (provider === "smtp") return json({ error: "SMTP senders are not available yet — connect Resend for now." }, 400);

  try { await verifyResendKey(apiKey); } catch (e) { return json({ error: resendMessage(e) }, 400); } // prove the key works before saving

  let enc: string;
  try { enc = await encryptSecret(apiKey, process.env.ENCRYPTION_KEY); }
  catch { return json({ error: "Server setup incomplete (encryption key missing). Tell the site admin." }, 500); }

  const { data: id, error } = await supabase.rpc("save_sender_account", {
    p_provider: provider, p_name: name, p_enc: enc,
    p_from_email: fromEmail, p_from_name: fromName || null, p_daily_limit: dailyLimit,
  });
  if (error) return json({ error: "Could not save the sender." }, 400);
  return json({ ok: true, id });
}

export async function PATCH(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string") return json({ error: "Bad request." }, 400);
  if (typeof b?.enabled === "boolean") {
    const { error } = await supabase.rpc("set_sender_enabled", { p_id: b.id, p_enabled: b.enabled });
    if (error) return json({ error: "Could not change this sender (enable needs a saved key)." }, 400);
    return json({ ok: true });
  }
  const fromEmail = typeof b?.fromEmail === "string" ? b.fromEmail.trim().toLowerCase() : "";
  const fromName = typeof b?.fromName === "string" ? b.fromName.trim() : "";
  const dailyLimit = b?.dailyLimit == null || b?.dailyLimit === "" ? null : Number(b.dailyLimit);
  if (!isEmail(fromEmail)) return json({ error: "Enter a valid sender email address." }, 400);
  if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10000))
    return json({ error: "Daily limit must be between 1 and 10000 (or empty for the plan limit)." }, 400);
  const { error } = await supabase.rpc("update_sender_account", {
    p_id: b.id, p_from_name: fromName || null, p_from_email: fromEmail, p_daily_limit: dailyLimit,
  });
  if (error) return json({ error: "Could not update this sender." }, 400);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string") return json({ error: "Bad request." }, 400);
  await supabase.rpc("delete_sender_account", { p_id: b.id });
  return json({ ok: true });
}
