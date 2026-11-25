/**
 * AI writer — draft and improve campaign emails with the USER'S OWN AI key
 * (Gemini first: free tier, plain fetch, key in a header; OpenAI second).
 * The key is stored encrypted like provider keys and is never returned,
 * logged, or put in a URL. The model is only asked for wording help — the
 * UI states plainly that inbox placement is never guaranteed.
 */
export const AI_PROVIDERS = ["gemini", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Words that commonly trip spam filters — guidance only, never a block. */
export const SPAM_WORDS = [
  "free", "guarantee", "guaranteed", "act now", "limited time", "click here",
  "buy now", "no cost", "winner", "congratulations", "double your income",
  "make money fast", "risk-free", "100% free", "urgent", "once in a lifetime",
];

export function spamHints(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SPAM_WORDS.filter((w) => lower.includes(w));
  const hints: string[] = [];
  if (found.length) hints.push(`Spam-filter words to soften or drop: ${found.join(", ")}.`);
  if (text.split(/\s+/).filter(Boolean).length > 200) hints.push("Long email — shorter outreach usually gets more replies.");
  if (/[!]{2,}/.test(text)) hints.push("Avoid multiple exclamation marks.");
  if ((text.match(/\$|€|£|৳/g) ?? []).length > 2) hints.push("Several currency symbols — keep prices out of the first email.");
  if (!/[?]/.test(text)) hints.push("Consider ending with one clear question — replies start conversations.");
  return hints;
}

export type DraftInput = {
  audience: string; // e.g. "dentists in Dhaka"
  goal: string; // e.g. "offer a website redesign"
  tone?: "friendly" | "formal" | "short";
  niche?: string;
  company?: string;
};

export function buildDraftPrompt(input: DraftInput): string {
  const tone = input.tone ?? "friendly";
  return [
    "Write a short cold-outreach email for a freelancer.",
    `Audience: ${input.audience}.`,
    `Goal: ${input.goal}.`,
    input.niche ? `Their business type: ${input.niche}.` : "",
    input.company ? `My company: ${input.company}.` : "",
    `Tone: ${tone}. Keep it under 120 words, one clear call to action, no spammy`,
    "words (no 'free', 'guaranteed', 'act now', no exclamation spam). Use",
    "{{name}} and {{company}} as merge fields where they fit naturally.",
    'Reply with JSON only: {"subject": "...", "body": "..."}.',
  ].filter(Boolean).join("\n");
}

export function buildImprovePrompt(subject: string, body: string, instruction?: string): string {
  return [
    "Improve this cold-outreach email. Keep the meaning, make it shorter and",
    "clearer, remove spammy wording, keep {{name}} / {{company}} merge fields.",
    instruction ? `Extra instruction: ${instruction}` : "",
    `Subject: ${subject}`,
    `Body:\n${body}`,
    'Reply with JSON only: {"subject": "...", "body": "..."}.',
  ].filter(Boolean).join("\n");
}

/** Pull {subject, body} out of the model's reply (JSON preferred, plain-text fallback). */
export function parseAiDraft(text: string): { subject: string; body: string } {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const j = JSON.parse(trimmed);
    if (typeof j?.subject === "string" && typeof j?.body === "string") {
      return { subject: j.subject.trim(), body: j.body.trim() };
    }
  } catch { /* fall through to plain text */ }
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const subjectLine = lines.find((l) => /^subject:/i.test(l));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "") : (lines[0] ?? "");
  const body = subjectLine ? lines.filter((l) => l !== subjectLine).join("\n") : lines.slice(1).join("\n");
  return { subject, body: body || trimmed };
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function callGemini(apiKey: string, prompt: string, fetchFn: FetchFn): Promise<string> {
  const res = await fetchFn(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const j: any = await res.json().catch(() => null);
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned no text.");
  return text;
}

async function callOpenAi(apiKey: string, prompt: string, fetchFn: FetchFn): Promise<string> {
  const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You write short cold-outreach emails. Reply with JSON only: {\"subject\": \"...\", \"body\": \"...\"}." },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const j: any = await res.json().catch(() => null);
  const text = j?.choices?.[0]?.message?.content ?? "";
  if (!String(text).trim()) throw new Error("OpenAI returned no text.");
  return String(text);
}

export function aiErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (/401|403/.test(m)) return "Your AI key was rejected. Check it in Email > AI writer.";
  if (/429/.test(m)) return "The AI provider is rate-limited right now. Try again in a minute.";
  if (/Gemini error|OpenAI error/.test(m)) return "The AI provider returned an error. Try again.";
  return "Could not reach the AI provider. Try again.";
}

export async function draftWithAi(
  provider: AiProvider, apiKey: string, input: DraftInput, fetchFn: FetchFn = fetch,
): Promise<{ subject: string; body: string }> {
  const prompt = buildDraftPrompt(input);
  const text = provider === "openai" ? await callOpenAi(apiKey, prompt, fetchFn) : await callGemini(apiKey, prompt, fetchFn);
  return parseAiDraft(text);
}

export async function improveWithAi(
  provider: AiProvider, apiKey: string, subject: string, body: string,
  instruction?: string, fetchFn: FetchFn = fetch,
): Promise<{ subject: string; body: string }> {
  const prompt = buildImprovePrompt(subject, body, instruction);
  const text = provider === "openai" ? await callOpenAi(apiKey, prompt, fetchFn) : await callGemini(apiKey, prompt, fetchFn);
  return parseAiDraft(text);
}

/** Prove a key works before saving it. Sends nothing, drafts nothing. */
export async function verifyAiKey(provider: AiProvider, apiKey: string, fetchFn: FetchFn = fetch): Promise<boolean> {
  try {
    if (provider === "gemini") {
      const res = await fetchFn("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(20000),
      });
      return res.ok;
    }
    const res = await fetchFn("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
