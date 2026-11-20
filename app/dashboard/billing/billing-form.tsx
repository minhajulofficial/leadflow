"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { paymentError, validatePayment } from "@/lib/billing";

type Method = { name: string; account_number: string; instructions: string | null };

export default function BillingForm({ price, methods }: { price: number; methods: Method[] }) {
  const supabase = createClient();
  const [method, setMethod] = useState(methods[0]?.name ?? "");
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const m = methods.find((x) => x.name === method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = validatePayment(sender, trx);
    if (bad) return setMsg({ ok: false, text: bad });
    setBusy(true);
    const { error } = await supabase.from("payments").insert({ plan: "pro", method, sender_number: sender, trx_id: trx });
    if (error) setMsg({ ok: false, text: paymentError(error.message, error.code) });
    else { setMsg({ ok: true, text: "Payment submitted. We will review it shortly and activate Pro." }); setTimeout(() => location.reload(), 1500); }
    setBusy(false);
  }

  if (!methods.length) return <section className="panel mt-4"><p>Payments are not open yet. Please check back soon.</p></section>;

  return (
    <form onSubmit={submit} className="panel mt-4 space-y-3">
      <h2 className="font-bold">Upgrade or renew Pro (৳{price} for 30 days)</h2>
      <div className="flex flex-wrap gap-2">
        {methods.map((x) => (
          <button type="button" key={x.name} className={x.name === method ? "btn btn-primary" : "btn"} onClick={() => setMethod(x.name)}>{x.name}</button>))}
      </div>
      {m && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--accent-soft)" }}>
          <p>Send <strong>৳{price}</strong> to <strong>{m.account_number}</strong> via {m.name}.</p>
          {m.instructions && <p className="mt-1" style={{ color: "var(--muted)" }}>{m.instructions}</p>}
        </div>
      )}
      <input className="field" placeholder="Your number you paid from (01XXXXXXXXX)" value={sender} onChange={(e) => setSender(e.target.value)} inputMode="tel" />
      <input className="field" placeholder="Transaction ID (TrxID)" value={trx} onChange={(e) => setTrx(e.target.value)} />
      <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "I have paid, submit"}</button>
      {msg && <p role="status" className="text-sm" style={{ color: msg.ok ? "var(--accent)" : "#d64545" }}>{msg.text}</p>}
    </form>
  );
}
