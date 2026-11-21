"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

type M = { id?: string; name: string; account_number: string; instructions: string | null; active: boolean };

export default function MethodsEditor({ initial }: { initial: M[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<M[]>(initial);
  const [msg, setMsg] = useState("");
  const set = (i: number, patch: Partial<M>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save(i: number) {
    const r = rows[i];
    if (!r.name.trim() || !r.account_number.trim()) return setMsg("Name and number are required.");
    const body = { name: r.name.trim(), account_number: r.account_number.trim(), instructions: r.instructions, active: r.active };
    const { error } = r.id ? await supabase.from("payment_methods").update(body).eq("id", r.id) : await supabase.from("payment_methods").insert(body);
    if (error) setMsg(error.message); else location.reload();
  }
  async function remove(i: number) {
    const r = rows[i];
    if (!r.id) return setRows(rows.filter((_, j) => j !== i));
    if (!confirm(`Delete ${r.name}?`)) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", r.id);
    if (error) setMsg(error.message); else location.reload();
  }

  return (
    <div className="space-y-4">
      {msg && <div role="alert" className="alert alert-bad"><Icon n="no" /><span>{msg}</span></div>}
      {rows.map((r, i) => (
        <div key={r.id ?? `new${i}`} className="panel grid gap-3 md:grid-cols-2">
          <input className="field" aria-label="Name" placeholder="Name (bKash, Nagad…)" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="field" aria-label="Account number" placeholder="Account number" value={r.account_number} onChange={(e) => set(i, { account_number: e.target.value })} />
          <input className="field md:col-span-2" aria-label="Instructions" placeholder="Instructions shown to the user" value={r.instructions ?? ""} onChange={(e) => set(i, { instructions: e.target.value })} />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} />Active (visible to users)</label>
          <div className="flex justify-end gap-2"><button className="btn btn-primary" onClick={() => save(i)}><Icon n="save" /> Save</button><button className="btn btn-danger" onClick={() => remove(i)}><Icon n="trash" /> Delete</button></div>
        </div>))}
      <button className="btn" onClick={() => setRows([...rows, { name: "", account_number: "", instructions: "", active: false }])}><Icon n="plus" /> Add method</button>
    </div>
  );
}
