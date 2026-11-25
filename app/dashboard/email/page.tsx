import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";

const STATUS_BADGE: Record<string, string> = {
  draft: "badge", scheduled: "badge badge-warn", sending: "badge badge-warn",
  paused: "badge badge-warn", sent: "badge badge-ok", cancelled: "badge badge-bad",
};

export default async function Email() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: campaigns }, { data: usageRows }, { data: senders }] = await Promise.all([
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("my_email_usage"),
    supabase.from("sender_accounts").select("id, active, has_key"),
  ]);
  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  const readySenders = (senders ?? []).filter((s: any) => s.active && s.has_key).length;
  const ids = (campaigns ?? []).map((c: any) => c.id);
  const counts: Record<string, { total: number; sent: number; failed: number }> = {};
  if (ids.length) {
    const { data: recs } = await supabase.from("campaign_recipients").select("campaign_id, status").in("campaign_id", ids);
    for (const r of recs ?? []) {
      counts[r.campaign_id] ??= { total: 0, sent: 0, failed: 0 };
      counts[r.campaign_id].total++;
      if (r.status === "sent") counts[r.campaign_id].sent++;
      if (r.status === "failed") counts[r.campaign_id].failed++;
    }
  }
  return (
    <div className="space-y-4">
      <PageHead icon="mail" title="Email outreach" subtitle="Send campaigns to your leads from your own Resend account. Unsubscribes are honoured automatically.">
        <Link href="/dashboard/email/campaigns/new" className="btn btn-primary"><Icon n="plus" /> New campaign</Link>
        <Link href="/dashboard/email/senders" className="btn"><Icon n="plug" /> Senders</Link>
        <Link href="/dashboard/email/templates" className="btn"><Icon n="save" /> Templates</Link>
        <Link href="/dashboard/email/suppression" className="btn"><Icon n="no" /> Suppression</Link>
      </PageHead>

      <section className="panel flex flex-wrap items-center gap-4">
        <div><p className="muted text-sm">Sent today</p><p className="text-xl font-bold">{usage?.sent_today ?? 0} / {usage?.lim ?? "–"}</p></div>
        <div><p className="muted text-sm">Ready senders</p><p className="text-xl font-bold">{readySenders}</p></div>
        {!readySenders && (
          <p className="alert alert-warn !mb-0 flex-1"><Icon n="warn" /> Connect a sender first — paste your Resend API key in <Link href="/dashboard/email/senders" className="font-bold underline">Senders</Link>. Resend verifies the key before it is saved.</p>
        )}
      </section>

      {!(campaigns ?? []).length ? (
        <section className="panel text-center"><div className="empty"><span className="icon-chip"><Icon n="mail" /></span>
          <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>No campaigns yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm">Pick leads, write a subject and body with {"{{name}}"}-style merge fields, preview it, then send.</p>
          <Link href="/dashboard/email/campaigns/new" className="btn btn-primary mt-5">Create your first campaign <Icon n="arrow" /></Link></div></section>
      ) : (
        <section className="panel table-wrap"><table className="tbl"><thead><tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Created</th></tr></thead><tbody>
          {(campaigns ?? []).map((c: any) => (
            <tr key={c.id}>
              <td><Link href={`/dashboard/email/campaigns/${c.id}`} className="font-semibold underline">{c.name || c.subject}</Link>
                <div className="muted text-xs">{c.subject}</div></td>
              <td><span className={STATUS_BADGE[c.status] ?? "badge"}>{c.status}</span></td>
              <td>{counts[c.id]?.sent ?? 0} / {counts[c.id]?.total ?? 0}{counts[c.id]?.failed ? <span className="text-[var(--bad)]"> · {counts[c.id].failed} failed</span> : ""}</td>
              <td className="muted">{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>))}
        </tbody></table></section>
      )}
    </div>
  );
}
