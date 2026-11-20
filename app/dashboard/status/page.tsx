import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      ? { name: "Your profile row", ok: false, detail: profileRes.error.message, fix: "Run leadflow-supabase-setup.sql (migration 0001)." }
      : profileRes.data
        ? { name: "Your profile row", ok: true, detail: `role = ${profileRes.data.role}, plan = ${profileRes.data.plan}` }
        : { name: "Your profile row", ok: false, detail: "No profile for this account.", fix: "Run leadflow-fix-admin.sql (creates missing profiles and makes you admin)." },
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
    fix: verified ? "Open /admin/mfa and enter the 6-digit code." : "Open /admin/mfa and scan the QR code. If no QR appears, enable TOTP in Supabase > Authentication > Multi-Factor." });
  const adminRpc = await supabase.rpc("is_admin");
  checks.push(adminRpc.error
    ? { name: "Database says you are admin", ok: false, detail: adminRpc.error.message, fix: "Run migration 0001 and 0003." }
    : { name: "Database says you are admin", ok: adminRpc.data === true, detail: String(adminRpc.data), fix: "Needs role = admin AND 2-step verification done in this session." });
  checks.push({ name: "Server has ENCRYPTION_KEY secret (Phase 4)", ok: !!process.env.ENCRYPTION_KEY, detail: process.env.ENCRYPTION_KEY ? "set" : "missing", fix: "Add it as a Secret in Cloudflare (see SETUP.md)." });

  const bad = checks.filter((c) => !c.ok);
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between"><span className="text-xl font-bold">Setup status</span><Link href="/dashboard" className="btn">Back</Link></header>
      <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>{bad.length ? `${bad.length} thing(s) need attention. Take a screenshot of this page if you need help.` : "Everything looks good."}</p>
      <section className="panel mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2 pr-3">{c.ok ? "✅" : "❌"}</td>
                <td className="pr-3 font-semibold">{c.name}</td>
                <td><span style={{ color: "var(--muted)" }}>{c.detail}</span>{!c.ok && c.fix && <div className="mt-1" style={{ color: "#d64545" }}>→ {c.fix}</div>}</td>
              </tr>))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
