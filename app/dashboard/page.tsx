import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("full_name, email, role, plan, plan_expires_at").eq("id", user.id).single();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">LeadFlow</span>
        <div className="flex gap-2">
          {profile?.role === "admin" && <Link href="/admin" className="btn">Admin</Link>}
          <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>
        </div>
      </header>

      <section className="mt-10 panel">
        <h1 className="text-2xl font-bold">Hi {profile?.full_name ?? profile?.email ?? "there"}</h1>
        <p className="mt-1" style={{ color: "var(--muted)" }}>
          You are on the <strong>{effectivePlan(profile?.plan, profile?.plan_expires_at)}</strong> plan.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard/leads" className="btn btn-primary">Open leads</Link>
          <Link href="/dashboard/billing" className="btn">Plan &amp; billing</Link>
        </div>
      </section>
    </main>
  );
}
