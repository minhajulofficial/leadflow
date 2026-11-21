import { requireAdmin } from "@/lib/admin";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";
import ReviewButtons from "./review-buttons";

const STATUS: Record<string, string> = { pending: "badge badge-warn", approved: "badge badge-ok", rejected: "badge badge-bad" };

export default async function Payments() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase.from("payments")
    .select("id, plan, amount, method, sender_number, trx_id, status, admin_note, created_at, user_id").order("created_at", { ascending: false }).limit(100);
  const ids = [...new Set(rows?.map((r) => r.user_id))];
  const { data: users } = await supabase.from("profiles").select("id, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const email = (id: string) => users?.find((u) => u.id === id)?.email ?? id;
  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const done = rows?.filter((r) => r.status !== "pending") ?? [];

  const Table = ({ list, actions }: { list: typeof pending; actions?: boolean }) => (
    <>
      <div className="table-wrap mt-3">
        <table className="tbl">
          <thead><tr><th>Date</th><th>User</th><th>Method</th><th>Paid from</th><th>TrxID</th><th>Amount</th><th>{actions ? "Action" : "Status"}</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td><td className="font-semibold">{email(p.user_id)}</td><td>{p.method}</td>
                <td>{p.sender_number}</td><td><code>{p.trx_id}</code></td><td>৳{p.amount}</td>
                <td>{actions ? <ReviewButtons id={p.id} /> : <><span className={STATUS[p.status]}>{p.status}</span>{p.admin_note && <p className="muted mt-1 text-xs">{p.admin_note}</p>}</>}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {!list.length && <div className="empty"><span className="icon-chip"><Icon n="receipt" /></span><p>Nothing here.</p></div>}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHead icon="money" title="Payments" subtitle="Check each payment in your bKash/Nagad account, then approve or reject it." />
      <section className="panel"><h2 className="font-bold">Waiting for review <span className="badge badge-warn ml-1">{pending.length}</span></h2><Table list={pending} actions /></section>
      <section className="panel"><h2 className="font-bold">Reviewed</h2><Table list={done} /></section>
    </div>
  );
}
