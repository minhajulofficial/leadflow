"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setMsg({ type: "error", text: error.message });
      else if (data.session) location.href = "/dashboard";
      else setMsg({ type: "ok", text: "Check your inbox and confirm your email to finish signing up." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "error", text: error.message });
      else location.href = "/dashboard";
    }
    setBusy(false);
  }

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="panel w-full max-w-md">
        <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {mode === "signin" ? "Sign in to continue to LeadFlow." : "Free plan, no card needed."}
        </p>

        <button className="btn w-full mt-6" onClick={google} type="button">Continue with Google</button>
        <div className="my-5 text-center text-sm" style={{ color: "var(--muted)" }}>or use email</div>

        <div className="space-y-3">
          <input className="field" type="email" placeholder="Email" value={email}
                 onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="field" type="password" placeholder="Password (min 8 characters)" value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          <button className="btn btn-primary w-full" onClick={onSubmit} disabled={busy || !email || password.length < 8}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>

        {msg && (
          <p role="alert" className="mt-4 text-sm" style={{ color: msg.type === "error" ? "#d64545" : "var(--accent)" }}>
            {msg.text}
          </p>
        )}

        <button className="mt-6 text-sm underline" style={{ color: "var(--muted)" }}
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
