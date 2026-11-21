"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/icon";
import { FIELDS, cleanLead, mapRow, toCSV, type LeadInput, type Rules } from "@/lib/leads";

type Row = Record<string, any>;
type Filters = { q: string; country: string; city: string; hasEmail: boolean; hasPhone: boolean; hasWebsite: boolean; source: string };
const PAGE = 25;
const EMPTY: Filters = { q: "", country: "", city: "", hasEmail: false, hasPhone: false, hasWebsite: false, source: "" };
const EXPORT_COLS = [...FIELDS, "rating", "reviews", "source", "created_at"];

export default function LeadsClient({ used, limit }: { used: number; limit: number | null }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [f, setF] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Rules>({ requireEmail: false, requirePhone: false, requireWebsite: false });
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [usedNow, setUsedNow] = useState(used);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useCallback((cols: string, opts?: { count: "exact" }) => {
    let q = supabase.from("leads").select(cols, opts).order("created_at", { ascending: false });
    if (f.q.trim()) {
      const t = f.q.trim().replace(/[%,()]/g, " ");
      q = q.or(`name.ilike.%${t}%,email.ilike.%${t}%,company.ilike.%${t}%,role.ilike.%${t}%,niche.ilike.%${t}%`);
    }
    if (f.country.trim()) q = q.ilike("country", f.country.trim());
    if (f.city.trim()) q = q.ilike("city", f.city.trim());
    if (f.hasEmail) q = q.not("email", "is", null);
    if (f.hasPhone) q = q.not("phone", "is", null);
    if (f.hasWebsite) q = q.not("website", "is", null);
    if (f.source) q = q.eq("source", f.source);
    return q;
  }, [f, supabase]);

  const load = useCallback(async () => {
    const { data, count, error } = await query("*", { count: "exact" }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) setMsg(error.message); else { setRows((data as Row[]) ?? []); setTotal(count ?? 0); }
  }, [query, page]);
  useEffect(() => { load(); }, [load]);

  const refreshUsage = async () => {
    const { data } = await supabase.rpc("my_lead_usage");
    const u = Array.isArray(data) ? data[0] : data;
    if (u) setUsedNow(u.used);
  };

  /** Insert in chunks; on any chunk error fall back to row-by-row so one duplicate never blocks the rest. */
  async function insertMany(leads: LeadInput[], source: "manual" | "csv") {
    let added = 0, dup = 0, limitHit = false;
    const payload = leads.map((l) => ({ ...l, source }));
    for (let i = 0; i < payload.length && !limitHit; i += 200) {
      const chunk = payload.slice(i, i + 200);
      const { error } = await supabase.from("leads").insert(chunk);
      if (!error) { added += chunk.length; continue; }
      for (const row of chunk) {
        const { error: e } = await supabase.from("leads").insert(row);
        if (!e) added++;
        else if (e.code === "23505") dup++;
        else if (e.message.includes("PLAN_LIMIT")) { limitHit = true; break; }
        else dup++;
      }
    }
    return { added, dup, limitHit };
  }

  const report = (r: { added: number; dup: number; limitHit: boolean }, skipped = 0) =>
    setMsg(`Added ${r.added}. Duplicates skipped: ${r.dup}. Filtered out: ${skipped}.` +
      (r.limitHit ? " Monthly plan limit reached, upgrade to Pro for more." : ""));

  async function onAdd(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { lead, reason } = cleanLead(add, rules);
    if (!lead) setMsg(`Not added: ${reason}.`);
    else { report(await insertMany([lead], "manual")); setAdd({}); setShowAdd(false); setPage(0); await load(); await refreshUsage(); }
    setBusy(false);
  }

  function onCSV(file: File) {
    setBusy(true); setMsg("Reading file…");
    Papa.parse<Row>(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        if (res.data.length > 5000) { setMsg("Max 5000 rows per file."); setBusy(false); return; }
        const good: LeadInput[] = []; let skipped = 0;
        for (const raw of res.data) {
          const { lead } = cleanLead(mapRow(raw), rules);
          if (lead) good.push(lead); else skipped++;
        }
        report(await insertMany(good, "csv"), skipped);
        setPage(0); await load(); await refreshUsage(); setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      },
      error: (err) => { setMsg(err.message); setBusy(false); },
    });
  }

  async function exportCSV() {
    setBusy(true); const all: Row[] = [];
    for (let i = 0; i < 5000; i += 1000) {
      const { data } = await query("*").range(i, i + 999);
      if (!data?.length) break; all.push(...(data as Row[])); if (data.length < 1000) break;
    }
    const blob = new Blob([toCSV(all, EXPORT_COLS)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    setMsg(`Exported ${all.length} leads.`); setBusy(false);
  }

  async function deleteSelected() {
    if (!selected.size || !confirm(`Delete ${selected.size} lead(s)?`)) return;
    const { error } = await supabase.from("leads").delete().in("id", [...selected]);
    if (error) setMsg(error.message); else { setSelected(new Set()); await load(); await refreshUsage(); }
  }

  const upd = (k: keyof Filters, v: string | boolean) => { setF({ ...f, [k]: v } as Filters); setPage(0); };
  const pct = limit ? Math.min(100, Math.round((usedNow / limit) * 100)) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const LINKS: [string, string, IconName][] = [["Website", "website", "globe"], ["Facebook", "facebook", "facebook"], ["Instagram", "instagram", "instagram"], ["LinkedIn", "linkedin", "linkedin"]];
  const warnMsg = /limit reached/i.test(msg);
  return (
    <div className="space-y-4">
      <section className="panel">
        <div className="flex items-center justify-between text-sm"><span className="font-semibold">Monthly usage</span><span className="muted">{usedNow}{limit ? ` of ${limit} leads` : " leads"}</span></div>
        {limit && <div className="progress mt-2.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>}
      </section>

      <section className="panel space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="field-icon md:col-span-2"><Icon n="search" /><input className="field" aria-label="Search leads" placeholder="Search name, email, company, role…" value={f.q} onChange={(e) => upd("q", e.target.value)} /></div>
          <div className="field-icon"><Icon n="globe" /><input className="field" aria-label="Country" placeholder="Country" value={f.country} onChange={(e) => upd("country", e.target.value)} /></div>
          <div className="field-icon"><Icon n="pin" /><input className="field" aria-label="City" placeholder="City" value={f.city} onChange={(e) => upd("city", e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([["hasEmail", "Has email", "mail"], ["hasPhone", "Has phone", "phone"], ["hasWebsite", "Has website", "globe"]] as const).map(([k, l, ic]) => (
            <button key={k} type="button" aria-pressed={f[k]} className={f[k] ? "btn btn-primary !py-1.5" : "btn !py-1.5"} onClick={() => upd(k, !f[k])}><Icon n={ic} />{l}</button>))}
          <select className="field !w-auto !py-1.5" aria-label="Source" value={f.source} onChange={(e) => upd("source", e.target.value)}>
            <option value="">All sources</option><option value="manual">Manual</option><option value="csv">CSV</option><option value="auto">Auto</option><option value="extension">Extension</option>
          </select>
          <button className="btn !py-1.5" onClick={() => { setF(EMPTY); setPage(0); }}><Icon n="undo" /> Reset</button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Icon n="plus" /> Add lead</button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Icon n="import" /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onCSV(e.target.files[0])} />
        <button className="btn" disabled={busy || !total} onClick={exportCSV}><Icon n="export" /> Export CSV</button>
        {selected.size > 0 && <button className="btn btn-danger" onClick={deleteSelected}><Icon n="trash" /> Delete ({selected.size})</button>}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="muted">When importing, skip leads without:</span>
          {([["requireEmail", "email"], ["requirePhone", "phone"], ["requireWebsite", "website"]] as const).map(([k, l]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.checked })} />{l}</label>))}
        </div>
      </section>

      {msg && <div role="status" className={`alert ${warnMsg ? "alert-warn" : "alert-info"}`}><Icon n={warnMsg ? "warn" : "info"} /><span>{msg}</span></div>}

      {showAdd && (
        <form onSubmit={onAdd} className="panel grid gap-3 md:grid-cols-3">
          {FIELDS.map((k) => (<input key={k} className="field" aria-label={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={add[k] ?? ""} onChange={(e) => setAdd({ ...add, [k]: e.target.value })} />))}
          <button className="btn btn-primary md:col-span-3" disabled={busy}><Icon n="save" /> Save lead</button>
        </form>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th className="w-8"><input type="checkbox" aria-label="Select all" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              <th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Location</th><th>Links</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label="Select lead" checked={selected.has(r.id)} onChange={(e) => { const x = new Set(selected); e.target.checked ? x.add(r.id) : x.delete(r.id); setSelected(x); }} /></td>
                  <td><p className="font-semibold">{r.name || "–"}</p>{r.company && r.company !== r.name && <p className="muted text-xs">{r.company}</p>}</td>
                  <td>{r.role || "–"}</td><td>{r.email || "–"}</td><td>{r.phone || "–"}</td>
                  <td>{[r.city, r.country].filter(Boolean).join(", ") || "–"}</td>
                  <td><span className="flex gap-2.5">{LINKS.filter(([, k]) => r[k] && /^https?:\/\//i.test(r[k])).map(([l, k, ic]) => (
                    <a key={k} href={r[k]} target="_blank" rel="noopener noreferrer nofollow" aria-label={l} title={l} className="muted hover:text-[var(--accent)]"><Icon n={ic} /></a>))}</span></td>
                  <td><span className={`badge ${r.source === "auto" ? "badge-warn" : ""}`}>{r.source}</span></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty"><span className="icon-chip"><Icon n="leads" /></span>
            <p className="font-bold" style={{ color: "var(--ink)" }}>No leads here yet</p>
            <p className="mt-1 text-sm">Add one by hand, import a CSV, or collect some automatically.</p></div>)}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="muted">{total} lead{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button className="btn !px-3" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon n="left" /></button>
            <span className="font-semibold">{page + 1} / {pages}</span>
            <button className="btn !px-3" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><Icon n="right" /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
