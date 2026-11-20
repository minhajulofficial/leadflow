import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("full_name, email, role, plan").eq("id", user.id).maybeSingle();
  const { data: exp } = await supabase.from("profiles").select("plan_expires_at").eq("id", user.id).maybeSingle();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">LeadFlow</span>
        <div className="flex gap-2">
          {profile?.role === "admin" && <Link href="/admin" className="btn">Admin</Link>}
          <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>
        </div>
      </header>

      {!profile && (
        <section className="mt-6 panel" role="alert" style={{ borderColor: "#d64545" }}>
          <p className="font-bold">Your profile could not be loaded.</p>
          {profileError && (
            <p className="mt-1 text-sm"><strong>Reason:</strong> {profileError.message}
              {/permission denied/i.test(profileError.message) && <> This means the database has not given the website permission to read its tables. Run <code>0006_grants.sql</code> in Supabase &gt; SQL Editor.</>}</p>
          )}
          <p className="mt-1 text-sm">This happens if you signed up before the database setup was run. In Supabase &gt; SQL Editor run the repair SQL (file <code>0005_backfill_profiles.sql</code>), then refresh this page. Not sure what is missing? Open <Link href="/dashboard/status" className="underline">Setup status</Link>.</p>
        </section>
      )}
      {profile && notice === "not-admin" && profile.role !== "admin" && (
        <section className="mt-6 panel" role="alert" style={{ borderColor: "#d64545" }}>
          <p className="font-bold">This account is not an admin yet.</p>
          <p className="mt-1 text-sm">In Supabase &gt; SQL Editor run this, then open /admin again (or check <Link href="/dashboard/status" className="underline">Setup status</Link>):</p>
          <pre className="mt-2 overflow-x-auto rounded-lg p-3 text-xs" style={{ background: "var(--accent-soft)" }}>{`update public.profiles set role='admin' where email='${user.email}';`}</pre>
        </section>
      )}
      <section className="mt-10 panel">
        <h1 className="text-2xl font-bold">Hi {profile?.full_name ?? profile?.email ?? "there"}</h1>
        <p className="mt-1" style={{ color: "var(--muted)" }}>
          You are on the <strong>{effectivePlan(profile?.plan, exp?.plan_expires_at)}</strong> plan.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard/leads" className="btn btn-primary">Open leads</Link>
          <Link href="/dashboard/collect" className="btn">Collect leads</Link>
          <Link href="/dashboard/integrations" className="btn">Integrations</Link>
          <Link href="/dashboard/status" className="btn">Setup status</Link>
          <Link href="/dashboard/billing" className="btn">Plan &amp; billing</Link>
        </div>
      </section>
    </main>
  );
}
