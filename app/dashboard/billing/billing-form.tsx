"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { paymentError, validatePayment } from "@/lib/billing";
import { Icon } from "@/components/icon";

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

  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(m?.account_number ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }

  if (!methods.length) return <section className="panel"><div className="alert alert-info"><Icon n="info" /><span>Payments are not open yet. Please check back soon.</span></div></section>;

  return (
    <form onSubmit={submit} className="panel space-y-4">
      <div className="flex items-start gap-3"><span className="icon-chip"><Icon n="crown" /></span>
        <div><h2 className="font-bold">Upgrade or renew Pro</h2><p className="muted text-sm">৳{price} for 30 days. Renewing adds time to your current plan.</p></div></div>

      <div><p className="label">1. Choose how you will pay</p>
        <div className="flex flex-wrap gap-2">{methods.map((x) => (
          <button type="button" key={x.name} aria-pressed={x.name === method} className={x.name === method ? "btn btn-primary" : "btn"} onClick={() => setMethod(x.name)}><Icon n="wallet" />{x.name}</button>))}</div></div>

      {m && (
        <div className="rounded-2xl p-4" style={{ background: "var(--accent-soft)" }}>
          <p className="label">2. Send <strong>৳{price}</strong> via {m.name} to</p>
          <div className="flex flex-wrap items-center gap-3"><span className="text-2xl font-extrabold tracking-wide">{m.account_number}</span>
            <button type="button" className="btn !py-1.5" onClick={copy}><Icon n={copied ? "check" : "copy"} />{copied ? "Copied" : "Copy"}</button></div>
          {m.instructions && <p className="muted mt-2 text-sm">{m.instructions}</p>}
        </div>)}

      <div><p className="label">3. Tell us about the payment</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field-icon"><Icon n="phone" /><input className="field" aria-label="Number you paid from" placeholder="Number you paid from (01XXXXXXXXX)" value={sender} onChange={(e) => setSender(e.target.value)} inputMode="tel" /></div>
          <div className="field-icon"><Icon n="receipt" /><input className="field" aria-label="Transaction ID" placeholder="Transaction ID (TrxID)" value={trx} onChange={(e) => setTrx(e.target.value)} /></div>
        </div></div>

      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <><Icon n="spinner" spin /> Submitting…</> : <><Icon n="check" /> I have paid, submit</>}</button>
      {msg && <div role="status" className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /><span>{msg.text}</span></div>}
    </form>
  );
}
