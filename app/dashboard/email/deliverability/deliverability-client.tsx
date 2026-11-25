"use client";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { spamHints } from "@/lib/email/ai-writer";

type Check = { found: boolean; record: string | null };
type Result = { domain: string; selector: string; spf: Check; dmarc: Check; dkim: Check; hints: string[] };

export default function DeliverabilityClient() {
  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("resend");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const hints = [...spamHints(subject), ...spamHints(body)].filter((v, i, a) => a.indexOf(v) === i);

  async function check() {
    setBusy(true); setMsg(null); setRes(null);
    const q = new URLSearchParams({ domain, selector });
    const r = await fetch(`/api/email/deliverability?${q}`);
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? "Could not check this domain." }); setBusy(false); return; }
    setRes(j as Result);
    setBusy(false);
  }

  const row = (label: string, c?: Check) => (
    <div className="flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
      <Icon n={c?.found ? "ok" : "no"} className={c?.found ? "text-[var(--ok)]" : "text-[var(--bad)]"} />
      <div className="min-w-0"><p className="font-bold">{label} {c?.found ? "— found" : "— missing"}</p>
        {c?.record && <p className="muted break-all text-xs">{c.record}</p>}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2"><label className="label" htmlFor="d-domain">Sending domain</label>
            <input id="d-domain" className="field" placeholder="e.g. acme.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
          <div><label className="label" htmlFor="d-selector">DKIM selector</label>
            <input id="d-selector" className="field" placeholder="resend" value={selector} onChange={(e) => setSelector(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary mt-3" disabled={busy || !domain.trim()} onClick={check}><Icon n="search" /> Check domain</button>
        {res && (
          <div className="mt-4 space-y-2">
            {row("SPF", res.spf)}{row("DKIM", res.dkim)}{row("DMARC", res.dmarc)}
            {res.hints.map((h) => <p key={h} className="alert alert-warn !mb-0"><Icon n="warn" /> {h}</p>)}
          </div>)}
      </section>

      <section className="panel">
        <h2 className="mb-1 font-bold">Warm-up &amp; spam-risk hints</h2>
        <p className="muted mb-3 text-sm">New domains should start small (20–50 emails/day for the first week), then double weekly while bounces stay under 2%. Never buy lists; only email businesses that expect to hear from you. Paste a subject + body to check for spam-filter wording.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="d-subject">Subject to check</label><input id="d-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><label className="label" htmlFor="d-body">Body to check</label><textarea id="d-body" className="field" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        {hints.length > 0 && <ul className="mt-3 space-y-1 text-sm">{hints.map((h) => <li key={h} className="alert alert-warn !mb-0"><Icon n="warn" /> {h}</li>)}</ul>}
        {(subject || body) && !hints.length && <p className="alert alert-ok mt-3 !mb-0"><Icon n="ok" /> No obvious spam triggers in this copy.</p>}
      </section>
    </div>
  );
}
