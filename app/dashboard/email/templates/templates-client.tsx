"use client";
import { Icon } from "@/components/icon";
import { useState } from "react";

type Template = { id: string; name: string; subject: string; body: string };

export default function TemplatesClient({ initial }: { initial: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [name, setName] = useState(""); const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/email/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, subject, body }) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not save." }); setBusy(false); return; }
    setMsg({ ok: true, text: "Template saved." });
    setName(""); setSubject(""); setBody("");
    const list: any = await (await fetch("/api/email/templates")).json().catch(() => ({}));
    setTemplates(list.templates ?? []);
    setBusy(false);
  }

  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await fetch("/api/email/templates", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id }) });
    setTemplates((cur) => cur.filter((x) => x.id !== t.id));
  }

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}
      <section className="panel">
        <div className="grid gap-3">
          <div><label className="label" htmlFor="t-name">Name</label><input id="t-name" className="field" placeholder="e.g. First touch — web design" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label" htmlFor="t-subject">Subject</label><input id="t-subject" className="field" placeholder="e.g. A faster website for {{company}}" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><label className="label" htmlFor="t-body">Body</label><textarea id="t-body" className="field" rows={7} placeholder={"Hi {{name}},\n\n…"} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary mt-4" disabled={busy || !name || (!subject && !body)} onClick={save}><Icon n="save" /> Save template</button>
      </section>
      <section className="panel">
        <h2 className="mb-3 font-bold">Your templates ({templates.length})</h2>
        {!templates.length ? <p className="muted text-sm">No templates yet.</p> : (
          <div className="space-y-3">{templates.map((t) => (
            <div key={t.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center gap-2"><p className="flex-1 font-bold">{t.name}</p>
                <button className="btn btn-danger !px-3" onClick={() => remove(t)} aria-label={`Delete ${t.name}`}><Icon n="trash" /></button></div>
              <p className="text-sm"><span className="muted">Subject: </span>{t.subject}</p>
              <p className="muted whitespace-pre-wrap text-sm">{t.body.slice(0, 300)}{t.body.length > 300 ? "…" : ""}</p>
            </div>))}
          </div>)}
      </section>
    </div>
  );
}
