import assert from "node:assert/strict";
import { buildDraftPrompt, buildImprovePrompt, parseAiDraft, spamHints, draftWithAi, verifyAiKey } from "@/lib/email/ai-writer";

let n = 0; const ok = (m: string) => console.log(`ok ${++n} ${m}`);

// --- prompt building ---
const p = buildDraftPrompt({ audience: "dentists in Dhaka", goal: "offer a website redesign", tone: "friendly" });
assert.match(p, /dentists in Dhaka/); assert.match(p, /website redesign/); assert.match(p, /friendly/);
assert.match(p, /{{name}}/); assert.match(p, /JSON/); ok("draft prompt carries audience, goal, tone, merge tokens and the JSON contract");
const imp = buildImprovePrompt("Old subject", "Old body with {{company}}.");
assert.match(imp, /Old subject/); assert.match(imp, /{{company}}/); ok("improve prompt carries the existing copy and keeps merge tokens");

// --- draft parsing (JSON preferred, plain-text fallback) ---
assert.deepEqual(parseAiDraft('{"subject":"Hi","body":"Hello"}'), { subject: "Hi", body: "Hello" });
assert.deepEqual(parseAiDraft('```json\n{"subject":"Hi","body":"Hello"}\n```'), { subject: "Hi", body: "Hello" });
assert.deepEqual(parseAiDraft("not json at all"), { subject: "not json at all", body: "not json at all" });
ok("AI drafts parse plain and fenced JSON, and fall back to plain text for garbage");

// --- spam-word guidance ---
assert.ok(spamHints("FREE money!!! act now, guaranteed").length >= 2); ok("spam hints flag FREE / !!! / guaranteed / act now");
assert.ok(spamHints("Make money fast — buy now, 100% free").length >= 1); ok("spam hints flag make-money-fast / buy now / 100% free");
assert.equal(spamHints("A short note about your website?").length, 0); ok("clean copy with a question gets no spam hints");
assert.ok(spamHints("BUY NOW BUY NOW BUY NOW").length >= 1); ok("shouting + buy-now is flagged");
assert.ok(spamHints("A very long email. ".repeat(60)).some((h) => /Long email/.test(h))); ok("over-200-word copy gets the length hint");

// --- provider calls with mocked fetch (no live key) ---
const calls: { url: string; headers: any }[] = [];
const mockFetch = (async (url: string, init: any) => {
  calls.push({ url, headers: init?.headers ?? {} });
  const gemini = url.includes("generativelanguage");
  return { ok: true, json: async () => gemini
    ? { candidates: [{ content: { parts: [{ text: '{"subject":"G subject","body":"G body"}' }] } }] }
    : { choices: [{ message: { content: '{"subject":"O subject","body":"O body"}' } }] } } as any;
}) as any;

const g = await draftWithAi("gemini", "AIza-test", { audience: "dentists", goal: "offer a redesign" }, mockFetch);
assert.equal(g.subject, "G subject"); assert.ok(calls[0].url.includes("generativelanguage.googleapis.com"));
assert.equal(calls[0].headers["x-goog-api-key"], "AIza-test"); ok("Gemini call uses the Google endpoint with the key in the x-goog-api-key header");
const o = await draftWithAi("openai", "sk-test", { audience: "dentists", goal: "offer a redesign" }, mockFetch);
assert.equal(o.subject, "O subject"); assert.ok(calls[1].url.includes("api.openai.com"));
assert.equal(calls[1].headers.authorization, "Bearer sk-test"); ok("OpenAI call uses the chat-completions endpoint with a Bearer key");
assert.equal(await verifyAiKey("gemini", "AIza-test", mockFetch), true); ok("key verification accepts a 200 from the provider");
assert.equal(await verifyAiKey("gemini", "AIza-test", (async () => ({ ok: false })) as any), false); ok("key verification rejects a non-200 (bad key)");

console.log(`\nALL ${n} AI WRITER TESTS PASSED`);
