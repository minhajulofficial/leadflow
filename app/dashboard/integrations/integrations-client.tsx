"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type P = { slug: string; name: string; description: string | null };
type S = { provider_slug: string; enabled: boolean; has_key: boolean };

export default function IntegrationsClient({ providers, settings }: { providers: P[]; settings: S[] }) {
  const supabase = createClient();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState("");
  const st = (slug: string) => settings.find((s) => s.provider_slug === slug);
  const say = (slug: string, ok: boolean, text: string) => setMsg({ ...msg, [slug]: { ok, text } });

  async function save(slug: string) {
    setBusy(slug);
    const res = await fetch("/api/providers/key", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, apiKey: keys[slug] ?? "" }) });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok) location.reload(); else { say(slug, false, j.error ?? "Could not save."); setBusy(""); }
  }
  async function remove(slug: string) {
    if (!confirm("Remove your saved key?")) return;
    await fetch("/api/providers/key", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) });
    location.reload();
  }
  async function toggle(slug: string, on: boolean) {
    const { error } = await supabase.rpc("set_provider_enabled", { p_slug: slug, p_enabled: on });
    if (error) say(slug, false, "Add your API key first."); else location.reload();
  }

  if (!providers.length) return <p className="panel mt-6">No providers are available right now.</p>;
  return (
    <div className="mt-6 space-y-4">
      {providers.map((p) => {
        const s = st(p.slug); const m = msg[p.slug];
        return (
          <section key={p.slug} className="panel space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-bold">{p.name}</h2><p className="text-sm" style={{ color: "var(--muted)" }}>{p.description}</p></div>
              {s?.has_key && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={(e) => toggle(p.slug, e.target.checked)} />Use this provider</label>)}
            </div>
            <p className="text-sm">{s?.has_key ? "✓ API key saved (hidden)." : "No API key yet."}</p>
            <div className="flex flex-wrap gap-2">
              <input className="field !w-auto flex-1 min-w-[16rem]" type="password" autoComplete="off" placeholder={s?.has_key ? "Paste a new key to replace" : "Paste your Apify API token"}
                     value={keys[p.slug] ?? ""} onChange={(e) => setKeys({ ...keys, [p.slug]: e.target.value })} />
              <button className="btn btn-primary" disabled={busy === p.slug || !(keys[p.slug] ?? "").trim()} onClick={() => save(p.slug)}>{busy === p.slug ? "Checking…" : "Save key"}</button>
              {s?.has_key && <button className="btn" onClick={() => remove(p.slug)}>Remove</button>}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Find it in Apify Console &gt; Settings &gt; API &amp; Integrations. We test the key before saving it.</p>
            {m && <p role="status" className="text-sm" style={{ color: m.ok ? "var(--accent)" : "#d64545" }}>{m.text}</p>}
          </section>
        );
      })}
    </div>
  );
}
