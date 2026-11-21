import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan } from "@/lib/plan";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";
import BillingForm from "./billing-form";

const STATUS: Record<string, string> = { pending: "badge badge-warn", approved: "badge badge-ok", rejected: "badge badge-bad" };

export default async function Billing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: exp }, { data: plans }, { data: methods }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("plan_expires_at").eq("id", user.id).maybeSingle(),
    supabase.from("plans").select("*").order("price_bdt"),
    supabase.from("payment_methods").select("name, account_number, instructions").eq("active", true),
    supabase.from("payments").select("id, plan, amount, method, trx_id, status, admin_note, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const current = effectivePlan(profile?.plan, exp?.plan_expires_at);
  const pro = plans?.find((p) => p.id === "pro");
  const expired = profile?.plan && profile.plan !== "free" && current === "free";

  return (
    <div className="space-y-6">
      <PageHead icon="card" title="Plan & billing" subtitle="Pay with bKash or Nagad. We activate Pro as soon as your payment is verified." />

      <div className={`alert ${expired ? "alert-warn" : "alert-info"}`}><Icon n={expired ? "warn" : "crown"} />
        <span>You are on the <strong>{current}</strong> plan.{current !== "free" && exp?.plan_expires_at && <> Valid until <strong>{new Date(exp.plan_expires_at).toLocaleDateString()}</strong>.</>}{expired && " Your paid plan has expired."}</span></div>

      <section className="grid gap-4 md:grid-cols-2">
        {plans?.map((p) => (
          <div key={p.id} className="panel" style={p.id === current ? { borderColor: "var(--accent)" } : undefined}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{p.name}</h2>{p.id === current && <span className="badge badge-ok"><Icon n="check" /> Current</span>}</div>
            <p className="mt-2"><span className="stat-num">{p.price_bdt === 0 ? "Free" : `৳${p.price_bdt}`}</span>{p.price_bdt > 0 && <span className="muted"> / 30 days</span>}</p>
            <ul className="mt-4 space-y-2 text-[.95rem]">
              <li className="flex gap-2.5"><Icon n="ok" className="mt-1 text-[var(--ok)]" />{p.limits.leads_per_month.toLocaleString()} leads per month</li>
              <li className="flex gap-2.5"><Icon n="ok" className="mt-1 text-[var(--ok)]" />Up to {p.limits.max_per_run} results per collection run</li>
              <li className="flex gap-2.5"><Icon n="ok" className="mt-1 text-[var(--ok)]" />{p.limits.emails_per_day} emails per day (coming soon)</li>
              <li className="flex gap-2.5"><Icon n={p.limits.extension ? "ok" : "no"} className={p.limits.extension ? "mt-1 text-[var(--ok)]" : "muted mt-1"} />Chrome extension (coming soon)</li>
            </ul>
          </div>))}
      </section>

      {pro && <BillingForm price={pro.price_bdt} methods={methods ?? []} />}

      <section className="panel">
        <h2 className="font-bold">Your payments</h2>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Method</th><th>TrxID</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payments?.map((p) => (
                <tr key={p.id}><td>{new Date(p.created_at).toLocaleDateString()}</td><td>{p.method}</td><td><code>{p.trx_id}</code></td><td>৳{p.amount}</td>
                  <td><span className={STATUS[p.status]}>{p.status}</span>{p.admin_note && <p className="muted mt-1 text-xs">{p.admin_note}</p>}</td></tr>))}
            </tbody>
          </table>
        </div>
        {!payments?.length && <div className="empty"><span className="icon-chip"><Icon n="receipt" /></span><p>No payments yet.</p></div>}
      </section>
    </div>
  );
}
