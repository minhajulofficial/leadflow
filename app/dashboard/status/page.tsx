import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";

type Check = { name: string; ok: boolean; detail: string; fix?: string };

export default async function Status() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const table = async (label: string, run: PromiseLike<{ error: { message: string } | null }>, fix: string): Promise<Check> => {
    try { const { error } = await run; return error ? { name: label, ok: false, detail: error.message, fix } : { name: label, ok: true, detail: "ok" }; }
    catch (e) { return { name: label, ok: false, detail: String(e), fix }; }
  };
  const head = (t: string) => supabase.from(t).select("*", { count: "exact", head: true });

  const profileRes = await supabase.from("profiles").select("id, email, role, plan").eq("id", user.id).maybeSingle();
  const checks: Check[] = [
    { name: "Signed in", ok: true, detail: user.email ?? user.id },
    profileRes.error
      ? { name: "Your profile row", ok: false, detail: profileRes.error.message, fix: "Run supabase/migrations/0001_init.sql." }
      : profileRes.data
        ? { name: "Your profile row", ok: true, detail: `role = ${profileRes.data.role}, plan = ${profileRes.data.plan}` }
        : { name: "Your profile row", ok: false, detail: "No profile for this account.", fix: "Run supabase/migrations/0005_backfill_profiles.sql (creates missing profiles), then set your role to admin in SQL Editor — see SETUP.md." },
    await table("Column plan_expires_at (0003)", supabase.from("profiles").select("plan_expires_at").limit(1), "Run migration 0003."),
    await table("Table leads (0002)", head("leads"), "Run migration 0002."),
    await table("Table payments (0003)", head("payments"), "Run migration 0003."),
    await table("Table providers (0004)", head("providers"), "Run migration 0004."),
    await table("Table lead_runs (0004)", head("lead_runs"), "Run migration 0004."),
  ];

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.length ?? 0;
  checks.push({ name: "2-step verification (this session)", ok: aal?.currentLevel === "aal2", detail: `level = ${aal?.currentLevel ?? "?"}, authenticator apps set up = ${verified}`,
    fix: verified ? "Open /two-step and enter the 6-digit code." : "Open /two-step and scan the QR code. If no QR appears, enable TOTP in Supabase > Authentication > Multi-Factor." });
  const adminRpc = await supabase.rpc("is_admin");
  checks.push(adminRpc.error
    ? { name: "Database says you are admin", ok: false, detail: adminRpc.error.message, fix: "Run migration 0001 and 0003." }
    : { name: "Database says you are admin", ok: adminRpc.data === true, detail: String(adminRpc.data), fix: "Needs role = admin AND 2-step verification done in this session." });
  checks.push({ name: "Server has ENCRYPTION_KEY secret (Phase 4)", ok: !!process.env.ENCRYPTION_KEY, detail: process.env.ENCRYPTION_KEY ? "set" : "missing", fix: "Add it as a Secret in Cloudflare (see SETUP.md)." });

  const bad = checks.filter((c) => !c.ok);
  return (
    <div className="space-y-6">
      <PageHead icon="health" title="Setup status" subtitle="A quick health check of your account and database.">
        <Link href="/dashboard/status" className="btn"><Icon n="refresh" /> Re-check</Link>
      </PageHead>
      <div className={`alert ${bad.length ? "alert-warn" : "alert-ok"}`} role="status"><Icon n={bad.length ? "warn" : "ok"} />
        <span>{bad.length ? `${bad.length} thing(s) need attention. Send a screenshot of this page if you need help.` : "Everything looks good."}</span></div>
      <section className="panel table-wrap">
        <table className="tbl"><tbody>
          {checks.map((c) => (
            <tr key={c.name}>
              <td className="w-8"><Icon n={c.ok ? "ok" : "no"} className={c.ok ? "text-[var(--ok)]" : "text-[var(--bad)]"} /></td>
              <td className="font-semibold">{c.name}</td>
              <td><span className="muted">{c.detail}</span>{!c.ok && c.fix && <div className="mt-1 text-[var(--bad)]">→ {c.fix}</div>}</td>
            </tr>))}
        </tbody></table>
      </section>
      <section className="panel space-y-2">
        <h2 className="text-lg font-bold">Google sign-in (setup checklist)</h2>
        <p className="muted text-sm">
          The &ldquo;Continue with Google&rdquo; button works only after the owner enables the Google
          provider — this page cannot detect that setting, so check it by hand (full steps in SETUP.md §2):
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Supabase → Authentication → Providers → enable <strong>Google</strong>, paste the OAuth client ID and secret from Google Cloud Console (APIs &amp; Services → Credentials → OAuth client ID, web application).</li>
          <li>In the same Google client, add the authorised redirect URI shown in Supabase (…/auth/v1/callback for your project).</li>
          <li>Supabase → Authentication → URL Configuration → add <code>https://YOUR-CLOUDFLARE-URL/auth/callback</code> to Redirect URLs.</li>
          <li>Sign out, open /login, click &ldquo;Continue with Google&rdquo; — you should land on /dashboard signed in.</li>
        </ol>
      </section>
    </div>
  );
}
