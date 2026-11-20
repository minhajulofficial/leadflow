import { requireAdmin } from "@/lib/admin";
import AdminNav from "../admin-nav";
import ReviewButtons from "./review-buttons";

export default async function Payments() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase.from("payments")
    .select("id, plan, amount, method, sender_number, trx_id, status, admin_note, created_at, user_id")
    .order("created_at", { ascending: false }).limit(100);
  const ids = [...new Set(rows?.map((r) => r.user_id))];
  const { data: users } = await supabase.from("profiles").select("id, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const email = (id: string) => users?.find((u) => u.id === id)?.email ?? id;
  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const done = rows?.filter((r) => r.status !== "pending") ?? [];

  const Table = ({ list, actions }: { list: typeof pending; actions?: boolean }) => (
    <table className="mt-3 w-full text-left text-sm">
      <thead style={{ color: "var(--muted)" }}><tr><th className="py-2">Date</th><th>User</th><th>Method</th><th>From</th><th>TrxID</th><th>Amount</th><th>{actions ? "Action" : "Status"}</th></tr></thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
            <td className="py-2">{new Date(p.created_at).toLocaleString()}</td><td>{email(p.user_id)}</td><td>{p.method}</td>
            <td>{p.sender_number}</td><td><code>{p.trx_id}</code></td><td>৳{p.amount}</td>
            <td>{actions ? <ReviewButtons id={p.id} /> : `${p.status}${p.admin_note ? ` (${p.admin_note})` : ""}`}</td>
          </tr>))}
        {!list.length && <tr><td colSpan={7} className="py-6 text-center" style={{ color: "var(--muted)" }}>Nothing here.</td></tr>}
      </tbody>
    </table>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <AdminNav />
      <section className="panel mt-6 overflow-x-auto"><h2 className="font-bold">Waiting for review ({pending.length})</h2><Table list={pending} actions /></section>
      <section className="panel mt-4 overflow-x-auto"><h2 className="font-bold">Reviewed</h2><Table list={done} /></section>
    </main>
  );
}
