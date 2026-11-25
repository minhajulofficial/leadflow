"use client";
import { Icon } from "@/components/icon";
import { useState } from "react";

type Sender = {
  id: string; provider: string; name: string; from_email: string; from_name: string | null;
  daily_limit: number | null; active: boolean; last_used_at: string | null; has_key: boolean;
};

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function SendersClient({ initial, planLimit }: { initial: Sender[]; planLimit: number | null }) {
  const [senders, setSenders] = useState(initial);
  const [name, setName] = useState(""); const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(""); const [fromName, setFromName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function refresh() {
    const j = await call("/api/email/senders", "GET");
    setSenders(j.senders ?? []);
  }

  async function connect() {
    setBusy(true); setMsg(null);
    try {
      await call("/api/email/senders", "POST", { provider: "resend", name, apiKey, fromEmail, fromName, dailyLimit });
      setMsg({ ok: true, text: "Sender connected — Resend accepted the key." });
      setName(""); setApiKey(""); setFromEmail(""); setFromName(""); setDailyLimit("");
      await refresh();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  async function toggle(s: Sender) {
    setBusy(true);
    try { await call("/api/email/senders", "PATCH", { id: s.id, enabled: !s.active }); await refresh(); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  async function remove(s: Sender) {
    if (!confirm(`Remove sender "${s.name}"? Campaigns using it will keep their history but cannot send.`)) return;
    setBusy(true);
    try { await call("/api/email/senders", "DELETE", { id: s.id }); await refresh(); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}
      <section className="panel">
        <h2 className="mb-1 font-bold">Connect Resend</h2>
        <p className="muted mb-4 text-sm">Create a free API key at resend.com/api-keys, then paste it here. We check the key with Resend before saving it. Your sender address must use a domain verified in Resend — for a first test you can use <code>onboarding@resend.dev</code>.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="s-name">Sender name</label><input id="s-name" className="field" placeholder="e.g. My Resend account" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label" htmlFor="s-from">From email</label><input id="s-from" className="field" placeholder="hello@yourdomain.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></div>
          <div><label className="label" htmlFor="s-fromname">From name (optional)</label><input id="s-fromname" className="field" placeholder="e.g. Minhajul" value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
          <div><label className="label" htmlFor="s-limit">Daily limit (optional, plan limit {planLimit ?? "–"})</label><input id="s-limit" className="field" type="number" min={1} max={10000} placeholder="Empty = plan limit" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="s-key">Resend API key</label>
            <div className="field-icon"><Icon n="key" /><input id="s-key" className="field" type={showKey ? "text" : "password"} autoComplete="off" placeholder="re_…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <button type="button" className="eye" aria-label={showKey ? "Hide key" : "Show key"} onClick={() => setShowKey(!showKey)}><Icon n={showKey ? "eyeOff" : "eye"} /></button></div></div>
        </div>
        <button className="btn btn-primary mt-4" disabled={busy || !name || !apiKey || !fromEmail} onClick={connect}><Icon n="plus" /> Connect sender</button>
      </section>

      <section className="panel">
        <h2 className="mb-3 font-bold">Your senders ({senders.length})</h2>
        {!senders.length ? <p className="muted text-sm">No senders yet.</p> : (
          <div className="space-y-3">{senders.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <span className="icon-chip sm"><Icon n="mail" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{s.name} <span className="muted font-normal">· {s.provider}</span></p>
                <p className="muted truncate text-sm">{s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email} · {s.has_key ? "key saved" : "no key"} · limit {s.daily_limit ?? `plan (${planLimit ?? "–"})`}{s.last_used_at ? ` · last used ${new Date(s.last_used_at).toLocaleDateString()}` : ""}</p>
              </div>
              <span className={s.active ? "badge badge-ok" : "badge"}>{s.active ? "Active" : "Off"}</span>
              <button className="btn !px-3" disabled={busy} onClick={() => toggle(s)}>{s.active ? "Turn off" : "Turn on"}</button>
              <button className="btn btn-danger !px-3" disabled={busy} onClick={() => remove(s)} aria-label={`Remove ${s.name}`}><Icon n="trash" /></button>
            </div>))}
          </div>)}
        <p className="muted mt-3 text-sm">Sending rotates across your active senders, and each sender stops at its daily limit. The queue never sends more than your plan allows per day.</p>
      </section>
    </div>
  );
}
