"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

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

  if (!providers.length) return <div className="panel empty"><span className="icon-chip"><Icon n="plug" /></span><p>No providers are available right now.</p></div>;
  return (
    <div className="space-y-4">
      {providers.map((p) => {
        const s = st(p.slug); const m = msg[p.slug];
        return (
          <section key={p.slug} className="panel space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="icon-chip"><Icon n="collect" /></span>
                <div><h2 className="font-bold">{p.name}</h2><p className="muted text-sm">{p.description}</p></div></div>
              {s?.has_key
                ? <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={s.enabled} onChange={(e) => toggle(p.slug, e.target.checked)} />Use this provider</label>
                : <span className="badge badge-warn"><Icon n="key" /> No key yet</span>}
            </div>
            {s?.has_key && <div className="alert alert-ok"><Icon n="ok" /><span>Your API key is saved (hidden). You can replace it any time.</span></div>}
            <div className="flex flex-wrap gap-2">
              <div className="field-icon min-w-[16rem] flex-1"><Icon n="key" /><input className="field" type="password" autoComplete="off" aria-label="API token" placeholder={s?.has_key ? "Paste a new key to replace the saved one" : "Paste your Apify API token"}
                value={keys[p.slug] ?? ""} onChange={(e) => setKeys({ ...keys, [p.slug]: e.target.value })} /></div>
              <button className="btn btn-primary" disabled={busy === p.slug || !(keys[p.slug] ?? "").trim()} onClick={() => save(p.slug)}>{busy === p.slug ? <><Icon n="spinner" spin /> Checking…</> : <><Icon n="save" /> Save key</>}</button>
              {s?.has_key && <button className="btn btn-danger" onClick={() => remove(p.slug)}><Icon n="trash" /> Remove</button>}
            </div>
            <p className="muted text-xs">Find it in Apify Console &gt; Settings &gt; API &amp; Integrations. We test the key before saving it.</p>
            {m && <div role="status" className={`alert ${m.ok ? "alert-ok" : "alert-bad"}`}><Icon n={m.ok ? "ok" : "no"} /><span>{m.text}</span></div>}
          </section>
        );
      })}
    </div>
  );
}
