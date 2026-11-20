"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MfaClient() {
  const supabase = createClient();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

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
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) setMsg("That code is wrong or expired. Try the newest code."); else location.href = "/admin";
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={verify} className="panel w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">{enrolling ? "Set up 2-step verification" : "Enter your code"}</h1>
        {enrolling && (
          <>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Scan this with Google Authenticator, Authy or similar, then enter the 6-digit code.</p>
            {qr && <img src={qr} alt="QR code" className="mx-auto h-44 w-44 bg-white p-2 rounded-xl" />}
            <p className="text-xs break-all" style={{ color: "var(--muted)" }}>Can’t scan? Key: <code>{secret}</code></p>
          </>
        )}
        {!enrolling && ready && <p className="text-sm" style={{ color: "var(--muted)" }}>Open your authenticator app and enter the current 6-digit code.</p>}
        <input className="field text-center text-xl tracking-widest" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
               onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
        <button className="btn btn-primary w-full" disabled={!ready || code.length !== 6}>Verify</button>
        {msg && <p role="alert" className="text-sm" style={{ color: "#d64545" }}>{msg}</p>}
      </form>
    </main>
  );
}
