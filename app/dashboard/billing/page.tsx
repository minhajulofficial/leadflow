import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";
import BillingForm from "./billing-form";

export default async function Billing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: plans }, { data: methods }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("plan, plan_expires_at").eq("id", user.id).single(),
    supabase.from("plans").select("*").order("price_bdt"),
    supabase.from("payment_methods").select("name, account_number, instructions").eq("active", true),
    supabase.from("payments").select("id, plan, amount, method, trx_id, status, admin_note, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const current = effectivePlan(profile?.plan, profile?.plan_expires_at);
  const pro = plans?.find((p) => p.id === "pro");

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">Plan &amp; billing</span>
        <Link href="/dashboard" className="btn">Back</Link>
      </header>

      <section className="panel mt-6">
        <p>Current plan: <strong>{current}</strong>
          {current !== "free" && profile?.plan_expires_at && <> · valid until {new Date(profile.plan_expires_at).toLocaleDateString()}</>}
          {profile?.plan !== "free" && current === "free" && <> · your paid plan has expired</>}</p>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {plans?.map((p) => (
          <div key={p.id} className="panel" style={p.id === current ? { borderColor: "var(--accent)" } : undefined}>
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="text-2xl font-bold mt-1">{p.price_bdt === 0 ? "Free" : `৳${p.price_bdt}/month`}</p>
            <ul className="mt-3 text-sm space-y-1" style={{ color: "var(--muted)" }}>
              <li>{p.limits.leads_per_month} leads / month</li>
              <li>{p.limits.emails_per_day} emails / day</li>
              <li>{p.limits.extension ? "Chrome extension included" : "No Chrome extension"}</li>
            </ul>
          </div>
        ))}
      </section>

      {pro && <BillingForm price={pro.price_bdt} methods={methods ?? []} />}

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="font-bold">Your payments</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead style={{ color: "var(--muted)" }}><tr><th className="py-2">Date</th><th>Method</th><th>TrxID</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payments?.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td><td>{p.method}</td><td>{p.trx_id}</td>
                <td>৳{p.amount}</td><td>{p.status}{p.admin_note ? ` (${p.admin_note})` : ""}</td>
              </tr>))}
            {!payments?.length && <tr><td colSpan={5} className="py-6 text-center" style={{ color: "var(--muted)" }}>No payments yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
