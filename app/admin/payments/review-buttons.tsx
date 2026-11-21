"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

export default function ReviewButtons({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  async function review(approve: boolean) {
    if (!confirm(approve ? "Approve this payment and activate Pro for 30 days?" : "Reject this payment?")) return;
    const { error } = await createClient().rpc("admin_review_payment", { p_id: id, p_approve: approve, p_note: note || null });
    if (error) setMsg(error.message); else location.reload();
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input className="field !w-32 !py-1.5" aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-primary !py-1.5" onClick={() => review(true)}><Icon n="check" /> Approve</button>
      <button className="btn btn-danger !py-1.5" onClick={() => review(false)}><Icon n="x" /> Reject</button>
      {msg && <span className="text-xs" style={{ color: "var(--bad)" }}>{msg}</span>}
    </div>
  );
}
