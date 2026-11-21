"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";
import { Icon } from "@/components/icon";

export default function TwoStepClient() {
  const supabase = createClient();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setMsg(error.message); return; }
      const verified = data?.totp?.[0];
      if (verified) { setFactorId(verified.id); setReady(true); return; }
      for (const f of data?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error: e2 } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "LeadFlow admin" });
      if (e2 || !en) { setMsg(e2?.message ?? "Could not start setup."); return; }
      setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret); setEnrolling(true); setReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) { setMsg("That code is wrong or expired. Try the newest code from your app."); setBusy(false); } else location.href = "/admin";
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <form onSubmit={verify} className="panel w-full max-w-md space-y-5 rise">
        <div className="flex items-center justify-between"><Logo /><span className="icon-chip"><Icon n="shield" /></span></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{enrolling ? "Set up 2-step verification" : "Enter your 6-digit code"}</h1>
          <p className="muted mt-1.5 text-sm">{enrolling ? "Admin access is protected. Scan this QR code with Google Authenticator, Authy or a similar app." : "Open your authenticator app and type the current code to open the admin area."}</p>
        </div>
        {enrolling && (
          <div className="text-center">
            {qr ? <img src={qr} alt="QR code to scan with your authenticator app" className="mx-auto h-44 w-44 rounded-2xl bg-white p-2" /> : <Icon n="spinner" spin />}
            <p className="muted mt-3 break-all text-xs">Can’t scan? Enter this key manually:<br /><code>{secret}</code></p>
          </div>)}
        {!ready && !msg && <p className="muted text-center text-sm"><Icon n="spinner" spin /> Getting ready…</p>}
        <div className="field-icon"><Icon n="lock" /><input className="field text-center text-xl tracking-[.4em]" aria-label="6-digit code" inputMode="numeric" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" /></div>
        <button className="btn btn-primary btn-lg w-full" disabled={!ready || code.length !== 6 || busy}>{busy ? <><Icon n="spinner" spin /> Checking…</> : "Verify and continue"}</button>
        {msg && <div role="alert" className="alert alert-bad"><Icon n="no" /><span>{msg}</span></div>}
        <Link href="/dashboard" className="muted block text-center text-sm underline">Back to dashboard</Link>
      </form>
    </main>
  );
}
