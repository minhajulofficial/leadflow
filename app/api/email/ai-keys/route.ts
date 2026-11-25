import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { verifyAiKey, type AiProvider } from "@/lib/email/ai-writer";
import { json, sameOriginJson } from "@/lib/http";

/** Own AI-provider keys (Gemini / OpenAI) for the AI writer. The encrypted
 *  key is never returned (see the column grant in 0008). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data } = await supabase.from("ai_keys")
    .select("id, provider, active, has_key, created_at").order("created_at");
  return json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const provider = (b?.provider === "openai" ? "openai" : "gemini") as AiProvider;
  const apiKey = typeof b?.apiKey === "string" ? b.apiKey.trim() : "";
  if (apiKey.length < 10 || apiKey.length > 200 || /\s/.test(apiKey)) {
    return json({ error: "That does not look like an API key." }, 400);
  }
  const ok = await verifyAiKey(provider, apiKey);
  if (!ok) return json({ error: `That ${provider} key was rejected. Check it and try again.` }, 400);
  let enc: string;
  try { enc = await encryptSecret(apiKey, process.env.ENCRYPTION_KEY); }
  catch { return json({ error: "Server setup incomplete (encryption key missing). Tell the site admin." }, 500); }
  const { data: id, error } = await supabase.rpc("save_ai_key", { p_provider: provider, p_enc: enc });
  if (error) return json({ error: "Could not save the AI key." }, 400);
  return json({ ok: true, id });
}

export async function PATCH(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || typeof b?.enabled !== "boolean") return json({ error: "Bad request." }, 400);
  const { error } = await supabase.rpc("set_ai_key_enabled", { p_id: b.id, p_enabled: b.enabled });
  if (error) return json({ error: "Could not change this key (enable needs a saved key)." }, 400);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string") return json({ error: "Bad request." }, 400);
  const { error } = await supabase.rpc("delete_ai_key", { p_id: b.id });
  if (error) return json({ error: "Could not delete this key." }, 400);
  return json({ ok: true });
}
