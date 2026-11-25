"use client";
import { useState } from "react";
import { Icon } from "@/components/icon";

type AiKey = { id: string; provider: string; active: boolean; has_key: boolean; created_at: string };

export default function AiClient({ initial }: { initial: AiKey[] }) {
  const [keys, setKeys] = useState(initial);
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const list: any = await (await fetch("/api/email/ai-keys")).json().catch(() => ({}));
    setKeys(list.keys ?? []);
  }

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/email/ai-keys", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not save the key." }); setBusy(false); return; }
    setApiKey("");
    setMsg({ ok: true, text: `${provider === "gemini" ? "Gemini" : "OpenAI"} key connected.` });
    setBusy(false);
    await refresh();
  }

  async function toggle(k: AiKey) {
    const res = await fetch("/api/email/ai-keys", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: k.id, enabled: !k.active }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not change this key." }); return; }
    await refresh();
  }

  async function remove(k: AiKey) {
    if (!confirm(`Remove the ${k.provider} key?`)) return;
    await fetch("/api/email/ai-keys", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: k.id }),
    });
    await refresh();
  }

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}
      <section className="panel">
        <h2 className="mb-1 font-bold">Connect an AI key</h2>
        <p className="muted mb-3 text-sm">Gemini is free to start (Google AI Studio); OpenAI needs credits. The key is verified before it is saved, then stored encrypted. AI drafts are wording help only — inbox placement is never guaranteed.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className="label" htmlFor="ai-provider">Provider</label>
            <select id="ai-provider" className="field" value={provider} onChange={(e) => setProvider(e.target.value as "gemini" | "openai")}>
              <option value="gemini">Gemini (free tier)</option><option value="openai">OpenAI</option>
            </select></div>
          <div className="md:col-span-2"><label className="label" htmlFor="ai-key">API key</label>
            <div className="flex gap-2">
              <input id="ai-key" className="field" type={show ? "text" : "password"} placeholder={provider === "gemini" ? "AIza…" : "sk-…"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <button className="btn" type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"}><Icon n={show ? "eyeOff" : "eye"} /></button>
            </div></div>
        </div>
        <button className="btn btn-primary mt-3" disabled={busy || apiKey.trim().length < 10} onClick={save}><Icon n="key" /> Verify &amp; save key</button>
      </section>

      <section className="panel">
        <h2 className="mb-3 font-bold">Your AI keys</h2>
        {!keys.length ? <p className="muted text-sm">No AI key connected yet.</p> : (
          <div className="space-y-2">{keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <span className="font-bold">{k.provider === "gemini" ? "Gemini" : "OpenAI"}</span>
              <span className={k.active ? "badge badge-ok" : "badge"}>{k.active ? "active" : "off"}</span>
              <span className="muted text-sm">{k.has_key ? "key saved" : "no key"}</span>
              <span className="flex-1" />
              <button className="btn !px-3 !py-1" onClick={() => toggle(k)}>{k.active ? "Switch off" : "Switch on"}</button>
              <button className="btn btn-danger !px-3 !py-1" onClick={() => remove(k)}><Icon n="trash" /> Remove</button>
            </div>))}
          </div>)}
      </section>
    </div>
  );
}
