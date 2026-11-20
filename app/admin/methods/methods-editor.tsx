"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <div className="mt-4 space-y-3">
      {rows.map((r, i) => (
        <div key={r.id ?? `new${i}`} className="panel grid gap-3 md:grid-cols-2">
          <input className="field" placeholder="Name (bKash, Nagad…)" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="field" placeholder="Account number" value={r.account_number} onChange={(e) => set(i, { account_number: e.target.value })} />
          <input className="field md:col-span-2" placeholder="Instructions shown to the user" value={r.instructions ?? ""} onChange={(e) => set(i, { instructions: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} />Active</label>
          <div className="flex gap-2 justify-end"><button className="btn btn-primary" onClick={() => save(i)}>Save</button><button className="btn" onClick={() => remove(i)}>Delete</button></div>
        </div>))}
      <button className="btn" onClick={() => setRows([...rows, { name: "", account_number: "", instructions: "", active: false }])}>+ Add method</button>
      {msg && <p role="status" className="text-sm" style={{ color: "#d64545" }}>{msg}</p>}
    </div>
  );
}
