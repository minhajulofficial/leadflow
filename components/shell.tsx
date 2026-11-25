import Link from "next/link";
import Logo from "./logo";
import { Icon } from "./icon";
import { SideNav, TabBar, type NavItem } from "./nav";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";

const USER_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", exact: true },
  { href: "/dashboard/leads", label: "My leads", icon: "leads" },
  { href: "/dashboard/collect", label: "Collect leads", icon: "collect" },
  { href: "/dashboard/email", label: "Email", icon: "mail" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "plug" },
  { href: "/dashboard/billing", label: "Plan & billing", icon: "card" },
];
const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "chart", exact: true },
  { href: "/admin/payments", label: "Payments", icon: "money" },
  { href: "/admin/methods", label: "Payment methods", icon: "wallet" },
  { href: "/admin/collect", label: "Collect settings", icon: "sliders" },
];
const TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home", exact: true },
  { href: "/dashboard/leads", label: "Leads", icon: "leads" },
  { href: "/dashboard/collect", label: "Collect", icon: "collect" },
  { href: "/dashboard/email", label: "Email", icon: "mail" },
  { href: "/dashboard/billing", label: "Plan", icon: "card" },
];

/** App frame: sidebar on desktop, top bar + bottom tabs on phones. Pages still check login themselves. */
export default async function Shell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <>{children}</>;
  const { data: p } = await supabase.from("profiles").select("full_name, role, plan").eq("id", user.id).maybeSingle();
  const { data: exp } = await supabase.from("profiles").select("plan_expires_at").eq("id", user.id).maybeSingle();
  const isAdmin = p?.role === "admin";
  const plan = effectivePlan(p?.plan, exp?.plan_expires_at);
  const name = p?.full_name || user.email?.split("@")[0] || "You";
  const groups = [
    { items: USER_ITEMS.concat([{ href: "/dashboard/status", label: "Setup status", icon: "health" }]) },
    ...(isAdmin ? [{ label: "Admin", items: ADMIN_ITEMS }] : []),
  ];
  const tabs = isAdmin ? [...TABS.slice(0, 4), { href: "/admin", label: "Admin", icon: "shield" as const }] : TABS;

  const SignOut = ({ label }: { label?: string }) => (
    <form action="/auth/signout" method="post">
      <button className={label ? "btn w-full" : "btn !px-3"} aria-label="Sign out" title="Sign out"><Icon n="logout" />{label}</button>
    </form>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-3 border-r p-5 lg:flex" style={{ background: "var(--card)", borderColor: "var(--line)" }}>
        <Link href="/dashboard" aria-label="LeadFlow home" className="mb-2 px-1"><Logo /></Link>
        <SideNav groups={groups} />
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--line)" }}>
          <div className="mb-3 flex items-center gap-3">
            <span className="icon-chip sm font-bold" aria-hidden="true">{name[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              <span className={plan === "free" ? "badge" : "badge badge-ok"}>{plan === "free" ? "Free plan" : <><Icon n="crown" /> {plan} plan</>}</span>
            </div>
          </div>
          <SignOut label="Sign out" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-2.5 backdrop-blur lg:hidden"
                style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)", borderColor: "var(--line)", paddingTop: "max(.625rem, env(safe-area-inset-top))" }}>
          <Link href="/dashboard" aria-label="LeadFlow home"><Logo size={30} /></Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/integrations" className="btn !px-3" aria-label="Integrations"><Icon n="plug" /></Link>
            <Link href="/dashboard/status" className="btn !px-3" aria-label="Setup status"><Icon n="health" /></Link>
            <SignOut />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 pb-28 lg:px-10 lg:py-10 lg:pb-10">{children}</main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t lg:hidden" style={{ background: "var(--card)", borderColor: "var(--line)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <TabBar items={tabs} />
      </div>
    </div>
  );
}
