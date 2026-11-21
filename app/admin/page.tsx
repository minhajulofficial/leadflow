import { requireAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/plan";
import { Icon, type IconName } from "@/components/icon";
import PageHead from "@/components/page-head";
import UserPlan from "./user-plan";

export default async function Admin() {
  const { supabase } = await requireAdmin();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [users, pending, pro, { data: list }, { data: audit }] = await Promise.all([
    count(supabase.from("profiles").select("id", { count: "exact", head: true })),
    count(supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("profiles").select("id", { count: "exact", head: true }).neq("plan", "free")),
    supabase.from("profiles").select("id, email, role, plan, plan_expires_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_logs").select("id, action, detail, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const stats: [string, number, IconName][] = [["Users", users, "users"], ["Payments to review", pending, "hourglass"], ["Paid plans", pro, "crown"]];

  return (
    <div className="space-y-6">
      <PageHead icon="chart" title="Admin overview" subtitle="Users, payments and recent admin activity." />
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(([l, v, ic]) => (
          <div key={l} className="panel"><div className="flex items-center justify-between"><span className="muted text-sm font-semibold">{l}</span><span className="icon-chip sm"><Icon n={ic} /></span></div><p className="stat-num mt-2">{v}</p></div>))}
      </section>

      <section className="panel">
        <h2 className="font-bold">Users</h2>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead><tr><th>Email</th><th>Role</th><th>Plan</th><th>Expires</th><th>Change plan</th></tr></thead>
            <tbody>
              {list?.map((u) => { const pl = effectivePlan(u.plan, u.plan_expires_at); return (
                <tr key={u.id}>
                  <td className="font-semibold">{u.email}</td>
                  <td><span className={u.role === "admin" ? "badge badge-warn" : "badge"}>{u.role}</span></td>
                  <td><span className={pl === "free" ? "badge" : "badge badge-ok"}>{pl}</span></td>
                  <td>{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : "–"}</td>
                  <td><UserPlan userId={u.id} /></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="font-bold">Recent admin activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {audit?.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2"><span className="badge">{a.action}</span><span className="muted">{new Date(a.created_at).toLocaleString()}</span></li>)}
          {!audit?.length && <li className="muted">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}
