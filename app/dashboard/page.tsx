import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";
import { Icon, type IconName } from "@/components/icon";
import PageHead from "@/components/page-head";

const ACTIONS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/dashboard/collect", icon: "collect", title: "Collect leads", text: "Find businesses by niche and city." },
  { href: "/dashboard/leads", icon: "leads", title: "My leads", text: "Search, filter, import and export." },
  { href: "/dashboard/integrations", icon: "plug", title: "Integrations", text: "Connect your Apify account." },
  { href: "/dashboard/billing", icon: "card", title: "Plan & billing", text: "Upgrade to Pro for higher limits." },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, email, role, plan").eq("id", user.id).maybeSingle();
  const { data: exp } = await supabase.from("profiles").select("plan_expires_at").eq("id", user.id).maybeSingle();
  const { data: usageData } = await supabase.rpc("my_lead_usage");
  const { count: total } = await supabase.from("leads").select("id", { count: "exact", head: true });
  const { data: keys } = await supabase.from("user_provider_settings").select("has_key, enabled");

  const usage = Array.isArray(usageData) ? usageData[0] : usageData;
  const used = usage?.used ?? 0, limit: number | null = usage?.lim ?? null;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const plan = effectivePlan(profile?.plan, exp?.plan_expires_at);
  const first = (profile?.full_name || user.email?.split("@")[0] || "there").split(" ")[0];
  const steps = [
    { done: !!keys?.some((k) => k.has_key), text: "Connect your Apify account", href: "/dashboard/integrations" },
    { done: (total ?? 0) > 0, text: "Collect or add your first leads", href: "/dashboard/collect" },
    { done: plan !== "free", text: "Upgrade when you need more room", href: "/dashboard/billing" },
  ];

  return (
    <div className="space-y-6">
      <PageHead icon="home" title={`Hi ${first} 👋`} subtitle="Here is what is happening with your leads." />

      {!profile && (
        <div className="alert alert-bad" role="alert"><Icon n="no" /><div>
          <p className="font-bold">Your profile could not be loaded.</p>
          {profileError && <p className="mt-1">Reason: {profileError.message}{/permission denied/i.test(profileError.message) && " Run 0006_grants.sql in Supabase > SQL Editor."}</p>}
          <p className="mt-1">Not sure what is missing? Open <Link href="/dashboard/status" className="underline">Setup status</Link>.</p>
        </div></div>
      )}
      {profile && notice === "not-admin" && profile.role !== "admin" && (
        <div className="alert alert-warn" role="alert"><Icon n="warn" /><div>
          <p className="font-bold">This account is not an admin yet.</p>
          <p className="mt-1">In Supabase &gt; SQL Editor run this, then open /admin again:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg p-3 text-xs" style={{ background: "var(--card)" }}>{`update public.profiles set role='admin' where email='${user.email}';`}</pre>
        </div></div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel md:col-span-1">
          <div className="flex items-center justify-between"><span className="muted text-sm font-semibold">Leads this month</span><span className="icon-chip sm"><Icon n="leads" /></span></div>
          <p className="stat-num mt-2">{used}{limit ? <span className="muted text-lg font-semibold"> / {limit}</span> : null}</p>
          {limit && <div className="progress mt-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>}
          {limit && pct >= 80 && <p className="mt-2 text-xs" style={{ color: "var(--warn)" }}>You are close to your monthly limit.</p>}
        </div>
        <div className="panel">
          <div className="flex items-center justify-between"><span className="muted text-sm font-semibold">Total leads saved</span><span className="icon-chip sm"><Icon n="layers" /></span></div>
          <p className="stat-num mt-2">{total ?? 0}</p>
          <Link href="/dashboard/leads" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--accent)" }}>View all <Icon n="arrow" /></Link>
        </div>
        <div className="panel">
          <div className="flex items-center justify-between"><span className="muted text-sm font-semibold">Your plan</span><span className="icon-chip sm"><Icon n="crown" /></span></div>
          <p className="stat-num mt-2 capitalize">{plan}</p>
          <p className="muted mt-3 text-sm">{plan !== "free" && exp?.plan_expires_at ? `Valid until ${new Date(exp.plan_expires_at).toLocaleDateString()}` : <Link href="/dashboard/billing" className="font-semibold underline">Upgrade to Pro</Link>}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="panel card-link"><span className="icon-chip"><Icon n={a.icon} /></span>
              <div><p className="font-bold">{a.title}</p><p className="muted text-sm">{a.text}</p></div><Icon n="arrow" className="muted ml-auto self-center" /></Link>))}
        </div>
      </section>

      <section className="panel">
        <h2 className="text-lg font-bold">Getting started</h2>
        <ul className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.text}><Link href={s.href} className="flex items-center gap-3 rounded-xl p-2 no-underline hover:bg-[var(--accent-soft)]">
              <span className={s.done ? "badge badge-ok" : "badge"}><Icon n={s.done ? "check" : "clock"} /></span>
              <span className={s.done ? "muted line-through" : "font-semibold"}>{s.text}</span></Link></li>))}
        </ul>
      </section>
    </div>
  );
}
