"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";
import { Icon } from "@/components/icon";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => { if (new URLSearchParams(location.search).get("mode") === "signup") setMode("signup"); }, []);

  const friendly = (m: string) => {
    if (/email not confirmed/i.test(m)) return "Your email is not confirmed yet. Open the confirmation email we sent you.";
    if (/invalid login credentials/i.test(m)) return "Wrong email or password. If you just signed up, confirm your email first.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/error sending|smtp/i.test(m)) return "We could not send the confirmation email. Please try again later.";
    if (/database error/i.test(m)) return "The database is not set up yet. Please contact the site admin.";
    return m;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email.trim()) return setMsg({ type: "error", text: "Enter your email." });
    if (password.length < 8) return setMsg({ type: "error", text: "Password must be at least 8 characters." });
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) setMsg({ type: "error", text: friendly(error.message) });
        else if (data.user && data.user.identities?.length === 0) setMsg({ type: "error", text: "This email is already registered. Please sign in." });
        else if (data.session) location.href = "/dashboard";
        else setMsg({ type: "ok", text: "Account created. Check your inbox and confirm your email, then sign in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMsg({ type: "error", text: friendly(error.message) });
        else location.href = "/dashboard";
      }
    } catch { setMsg({ type: "error", text: "Could not reach the server. Check your internet and try again." }); }
    setBusy(false);
  }

  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
  }

  const signup = mode === "signup";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: "var(--grad)" }}>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <Link href="/" className="relative inline-flex items-center gap-2.5 text-xl font-extrabold"><Logo size={38} text={false} onDark />LeadFlow</Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Turn directories into a pipeline of clients.</h2>
          <ul className="mt-8 space-y-4">
            {["Collect leads automatically by niche and city", "Filter out leads without a phone, website or good rating", "Import, export and keep everything organised"].map((t) => (
              <li key={t} className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-white/20 text-xs"><Icon n="check" /></span><span className="text-white/95">{t}</span></li>))}
          </ul>
        </div>
        <p className="relative text-sm text-white/75">Free to start. No card needed.</p>
      </section>

      <section className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-md rise">
          <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="LeadFlow home"><Logo /></Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="muted mt-1.5">{signup ? "Start on the free plan in under a minute." : "Sign in to continue to LeadFlow."}</p>

          <button type="button" className="btn btn-lg mt-7 w-full" onClick={google}><Icon n="google" /> Continue with Google</button>
          <div className="muted my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider"><span className="h-px flex-1" style={{ background: "var(--line)" }} />or with email<span className="h-px flex-1" style={{ background: "var(--line)" }} /></div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div><label className="label" htmlFor="email">Email</label>
              <div className="field-icon"><Icon n="mail" /><input id="email" className="field" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div></div>
            <div><label className="label" htmlFor="password">Password</label>
              <div className="field-icon"><Icon n="lock" />
                <input id="password" className="field" type={show ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} style={{ paddingRight: "2.8rem" }} />
                <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}><Icon n={show ? "eyeOff" : "eye"} /></button></div></div>
            <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? <><Icon n="spinner" spin /> Please wait…</> : signup ? "Create account" : "Sign in"}</button>
          </form>

          {msg && <div role={msg.type === "error" ? "alert" : "status"} className={`alert mt-5 ${msg.type === "error" ? "alert-bad" : "alert-ok"}`}><Icon n={msg.type === "error" ? "no" : "ok"} /><span>{msg.text}</span></div>}

          <p className="muted mt-7 text-center text-sm">
            {signup ? "Already have an account?" : "New to LeadFlow?"}{" "}
            <button className="font-bold underline" style={{ color: "var(--accent)" }} onClick={() => { setMode(signup ? "signin" : "signup"); setMsg(null); }}>{signup ? "Sign in" : "Create an account"}</button>
          </p>
        </div>
      </section>
    </main>
  );
}
