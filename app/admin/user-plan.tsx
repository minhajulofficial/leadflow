"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UserPlan({ userId }: { userId: string }) {
  const [plan, setPlan] = useState("pro");
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState("");
  async function apply() {
    const { error } = await createClient().rpc("admin_set_plan", { p_user: userId, p_plan: plan, p_days: days });
    if (error) setMsg(error.message); else location.reload();
  }
  return (
    <div className="flex items-center gap-1">
      <select className="field !w-auto !py-1" value={plan} onChange={(e) => setPlan(e.target.value)}><option value="pro">pro</option><option value="free">free</option></select>
      <input className="field !w-16 !py-1" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Days" />
      <button className="btn !py-1" onClick={apply}>Set</button>
      {msg && <span className="text-xs" style={{ color: "#d64545" }}>{msg}</span>}
    </div>
  );
}
