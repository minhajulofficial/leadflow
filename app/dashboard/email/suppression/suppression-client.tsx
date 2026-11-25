"use client";
import { Icon } from "@/components/icon";
import { useState } from "react";

type Row = { id: string; email: string; reason: string; created_at: string };

export default function SuppressionClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  async function remove(r: Row) {
    if (!confirm(`Remove ${r.email} from the suppression list? Future campaigns may email it again.`)) return;
    const res = await fetch("/api/email/suppression", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id }) });
    if (!res.ok) { setMsg("Could not remove that address."); return; }
    setRows((cur) => cur.filter((x) => x.id !== r.id));
  }
  return (
    <section className="panel">
      {msg && <p className="alert alert-bad"><Icon n="no" /> {msg}</p>}
      {!rows.length ? <p className="muted text-sm">Nobody is suppressed yet. Unsubscribe clicks and bounces land here automatically.</p> : (
        <div className="space-y-2">{rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
            <span className="icon-chip sm"><Icon n="no" /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold">{r.email}</p>
              <p className="muted text-sm">{r.reason} · {new Date(r.created_at).toLocaleDateString()}</p></div>
            <button className="btn !px-3" onClick={() => remove(r)}>Remove</button>
          </div>))}
        </div>)}
    </section>
  );
}
