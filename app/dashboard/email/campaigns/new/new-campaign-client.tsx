"use client";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMemo, useState } from "react";
import { MERGE_FIELDS } from "@/lib/email/merge";

type Sender = { id: string; name: string; from_email: string };
type Template = { id: string; name: string; subject: string; body: string };
type Lead = { id: string; name: string | null; company: string | null; city: string | null; country: string | null; email: string };

const mergePreview = (tpl: string, lead: Lead) =>
  tpl.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_, f: string) => {
    const v = (lead as unknown as Record<string, unknown>)[f.toLowerCase()];
    return v == null ? "" : String(v);
  });

export default function NewCampaignClient({ senders, templates, leads }: { senders: Sender[]; templates: Template[]; leads: Lead[] }) {
  const [senderId, setSenderId] = useState(senders[0]?.id ?? "");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((l) => [l.name, l.company, l.email, l.city].some((v) => v?.toLowerCase().includes(needle)));
  }, [q, leads]);
  const firstSelected = leads.find((l) => selected.has(l.id));

  function toggle(id: string) {
    setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAll() {
    setSelected((cur) => {
      const allVisible = visible.every((l) => cur.has(l.id));
      const next = new Set(cur);
      if (allVisible) visible.forEach((l) => next.delete(l.id)); else visible.forEach((l) => next.add(l.id));
      return next;
    });
  }
  function useTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body); }
  }
  function insertField(f: string) {
    setBody((b) => `${b}{{${f}}}`);
  }

  async function create(draftOnly: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/email/campaigns", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ senderId, name, subject, body, leadIds: [...selected] }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not create the campaign." }); setBusy(false); return null; }
    setCreatedId(j.id);
    setMsg({ ok: true, text: `Draft saved: ${j.added} recipient(s)${j.skippedNoEmail ? `, ${j.skippedNoEmail} lead(s) without email skipped` : ""}${j.skippedSuppressed ? `, ${j.skippedSuppressed} unsubscribed skipped` : ""}.` });
    setBusy(false);
    if (!draftOnly) location.href = `/dashboard/email/campaigns/${j.id}`;
    return j.id as string;
  }

  if (!senders.length) return (
    <section className="panel text-center"><div className="empty"><span className="icon-chip"><Icon n="plug" /></span>
      <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>Connect a sender first</p>
      <p className="mx-auto mt-1 max-w-md text-sm">Campaigns send from your own Resend account. It takes a minute to connect.</p>
      <Link href="/dashboard/email/senders" className="btn btn-primary mt-5">Go to Senders <Icon n="arrow" /></Link></div></section>
  );

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label" htmlFor="c-sender">Sender</label>
            <select id="c-sender" className="field" value={senderId} onChange={(e) => setSenderId(e.target.value)}>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.from_email}</option>)}
            </select></div>
          <div><label className="label" htmlFor="c-name">Campaign name (optional)</label><input id="c-name" className="field" placeholder="e.g. Dhaka dentists — March" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="c-subject">Subject</label><input id="c-subject" className="field" placeholder="e.g. A faster website for {{company}}" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="c-body">Body</label>
            <textarea id="c-body" className="field" rows={9} placeholder={"Hi {{name}},\n\nI noticed {{company}}…"} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="muted mt-2 text-sm">Merge fields: {MERGE_FIELDS.map((f) => (
              <button key={f} type="button" className="btn !px-2 !py-0.5 !text-xs" onClick={() => insertField(f)}>{`{{${f}}}`}</button>))} — click to insert at the end. Every email also carries an unsubscribe link automatically.</p>
            {templates.length > 0 && (<p className="mt-2 text-sm">Start from a template: <select className="field !w-auto !py-1" defaultValue="" onChange={(e) => e.target.value && useTemplate(e.target.value)}><option value="">Choose…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></p>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-1 font-bold">Recipients — {selected.size} selected</h2>
        <p className="muted mb-3 text-sm">Showing your newest {leads.length} leads with an email address. Use My leads to add more.</p>
        <input className="field mb-3" aria-label="Filter recipients" placeholder="Filter by name, company, email or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mb-2 flex items-center gap-2"><button className="btn !px-3 !py-1" onClick={toggleAll}>{visible.every((l) => selected.has(l.id)) && visible.length ? "Deselect visible" : "Select visible"}</button><span className="muted text-sm">{visible.length} shown</span></div>
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {visible.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)" }}>
              <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
              <span className="min-w-0 flex-1"><span className="font-semibold">{l.name ?? l.company ?? "—"}</span> <span className="muted">· {l.email}</span>{l.company && l.name ? <span className="muted"> · {l.company}</span> : ""}{l.city ? <span className="muted"> · {l.city}</span> : ""}</span>
            </label>))}
          {!visible.length && <p className="muted py-4 text-center text-sm">No leads match.</p>}
        </div>
      </section>

      {firstSelected && subject && body && (
        <section className="panel">
          <h2 className="mb-2 font-bold">Preview — as {firstSelected.name ?? firstSelected.email} will see it</h2>
          <p className="mb-1 text-sm"><span className="muted">Subject: </span><strong>{mergePreview(subject, firstSelected)}</strong></p>
          <div className="whitespace-pre-wrap rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>{mergePreview(body, firstSelected)}</div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || !subject.trim() || !body.trim() || !selected.size} onClick={() => create(false)}>
          <Icon n="save" /> Save & open campaign</button>
        <button className="btn" disabled={busy || !subject.trim() || !body.trim() || !selected.size} onClick={() => create(true)}>Save draft only</button>
        {createdId && <Link href={`/dashboard/email/campaigns/${createdId}`} className="btn">Open campaign <Icon n="arrow" /></Link>}
      </div>
    </div>
  );
}
