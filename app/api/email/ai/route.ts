import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { aiErrorMessage, draftWithAi, improveWithAi, spamHints, type AiProvider } from "@/lib/email/ai-writer";
import { json, sameOriginJson } from "@/lib/http";

/**
 * AI writer (signed in only). Drafts or improves a subject + body with the
 * USER'S OWN AI key (Gemini or OpenAI), decrypted server-side and never
 * returned or logged. The reply carries spam-word hints; nothing here
 * promises inbox placement — the UI says so plainly.
 */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const action = b?.action === "improve" ? "improve" : "draft";
  const provider = (b?.provider === "openai" ? "openai" : "gemini") as AiProvider;
  const subject = typeof b?.subject === "string" ? b.subject.slice(0, 200) : "";
  const body = typeof b?.body === "string" ? b.body.slice(0, 50000) : "";
  if (action === "improve" && (!subject.trim() && !body.trim())) {
    return json({ error: "Write a subject or body first, then improve it." }, 400);
  }
  const { data: enc } = await supabase.rpc("get_ai_key", { p_provider: provider });
  if (!enc) return json({ error: `No ${provider} key connected. Add one in Email > AI writer.` }, 400);
  let apiKey: string;
  try { apiKey = await decryptSecret(enc, process.env.ENCRYPTION_KEY); }
  catch { return json({ error: "Could not read your AI key. Save it again in Email > AI writer." }, 500); }

  try {
    const out = action === "improve"
      ? await improveWithAi(provider, apiKey, subject, body, typeof b?.instruction === "string" ? b.instruction.slice(0, 500) : undefined)
      : await draftWithAi(provider, apiKey, {
          audience: typeof b?.audience === "string" ? b.audience.slice(0, 200) : "small businesses",
          goal: typeof b?.goal === "string" ? b.goal.slice(0, 500) : "introduce my service and start a conversation",
          tone: b?.tone === "formal" || b?.tone === "short" ? b.tone : "friendly",
          niche: typeof b?.niche === "string" ? b.niche.slice(0, 100) : undefined,
        });
    const hints = [...spamHints(out.subject), ...spamHints(out.body)].filter((v, i, a) => a.indexOf(v) === i);
    return json({ ok: true, subject: out.subject, body: out.body, hints });
  } catch (e) {
    return json({ error: aiErrorMessage(e) }, 400);
  }
}
