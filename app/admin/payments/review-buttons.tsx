"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReviewButtons({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  async function review(approve: boolean) {
    if (!confirm(approve ? "Approve this payment and activate Pro for 30 days?" : "Reject this payment?")) return;
    const { error } = await createClient().rpc("admin_review_payment", { p_id: id, p_approve: approve, p_note: note || null });
    if (error) setMsg(error.message); else location.reload();
  }
  return (
    <div className="flex items-center gap-1">
      <input className="field !w-32 !py-1" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-primary !py-1" onClick={() => review(true)}>Approve</button>
      <button className="btn !py-1" onClick={() => review(false)}>Reject</button>
      {msg && <span className="text-xs" style={{ color: "#d64545" }}>{msg}</span>}
    </div>
  );
}
