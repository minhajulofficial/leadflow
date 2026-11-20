import { requireAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/plan";
import AdminNav from "./admin-nav";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <AdminNav />
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[["Users", users], ["Pending payments", pending], ["Paid plans", pro]].map(([l, v]) => (
          <div key={l as string} className="panel"><p className="text-sm" style={{ color: "var(--muted)" }}>{l}</p><p className="text-3xl font-bold">{v}</p></div>))}
      </section>

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="font-bold">Users</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead style={{ color: "var(--muted)" }}><tr><th className="py-2">Email</th><th>Role</th><th>Plan</th><th>Expires</th><th>Change plan</th></tr></thead>
          <tbody>
            {list?.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2">{u.email}</td><td>{u.role}</td>
                <td>{effectivePlan(u.plan, u.plan_expires_at)}</td>
                <td>{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : "-"}</td>
                <td><UserPlan userId={u.id} /></td>
              </tr>))}
          </tbody>
        </table>
      </section>

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="font-bold">Recent admin activity</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {audit?.map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} · <strong>{a.action}</strong> · <code>{JSON.stringify(a.detail)}</code></li>)}
          {!audit?.length && <li style={{ color: "var(--muted)" }}>Nothing yet.</li>}
        </ul>
      </section>
    </main>
  );
}
