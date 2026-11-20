import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { apifyMe, apifyMessage } from "@/lib/apify";
import { json, sameOriginJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);

  const body: any = await req.json().catch(() => null);
  const slug = body?.slug, apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (typeof slug !== "string" || !slug.startsWith("apify-")) return json({ error: "Unknown provider." }, 400);
  if (apiKey.length < 10 || apiKey.length > 200 || /\s/.test(apiKey)) return json({ error: "That does not look like an API key." }, 400);

  try { await apifyMe(apiKey); } catch (e) { return json({ error: apifyMessage(e) }, 400); }   // prove the key works before saving

  let enc: string;
  try { enc = await encryptSecret(apiKey, process.env.ENCRYPTION_KEY); }
  catch { return json({ error: "Server setup incomplete (encryption key missing). Tell the site admin." }, 500); }

  const { error } = await supabase.rpc("save_provider_key", { p_slug: slug, p_enc: enc });
  if (error) return json({ error: "Could not save the key." }, 400);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const body: any = await req.json().catch(() => null);
  if (typeof body?.slug !== "string") return json({ error: "Bad request." }, 400);
  await supabase.rpc("delete_provider_key", { p_slug: body.slug });
  return json({ ok: true });
}
