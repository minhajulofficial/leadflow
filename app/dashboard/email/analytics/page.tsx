import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";

/**
 * Campaign analytics: open / click / reply / bounce rates per campaign,
 * per sender, and by lead niche. Rates are over delivered emails when
 * delivery events exist, otherwise over sent. Opens are counted per
 * recipient (distinct), not per pixel hit.
 */
type Row = { sent: number; delivered: Set<string>; opened: Set<string>; clicked: Set<string>; bounced: Set<string>; replied: Set<string>; complained: Set<string> };
const fresh = (): Row => ({ sent: 0, delivered: new Set(), opened: new Set(), clicked: new Set(), bounced: new Set(), replied: new Set(), complained: new Set() });
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

export default async function Analytics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: campaigns }, { data: recipients }, { data: events }, { data: senders }, { data: leads }] = await Promise.all([
    supabase.from("campaigns").select("id, name, subject, sender_id, status, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("campaign_recipients").select("id, campaign_id, lead_id, status").limit(5000),
    supabase.from("email_events").select("recipient_id, campaign_id, type").limit(5000),
    supabase.from("sender_accounts").select("id, name, from_email"),
    supabase.from("leads").select("id, niche").limit(5000),
  ]);
  const byCampaign = new Map<string, Row>();
  const bySender = new Map<string, Row>();
  const byNiche = new Map<string, Row>();
  const nicheOf = new Map((leads ?? []).map((l: any) => [l.id, l.niche ?? "—"]));
  const campOf = new Map((campaigns ?? []).map((c: any) => [c.id, c]));
  const recOf = new Map((recipients ?? []).map((r: any) => [r.id, r]));
  for (const r of recipients ?? []) {
    const row = byCampaign.get(r.campaign_id) ?? fresh();
    if (r.status === "sent") row.sent++;
    byCampaign.set(r.campaign_id, row);
    const c = campOf.get(r.campaign_id) as any;
    if (c?.sender_id) {
      const s = bySender.get(c.sender_id) ?? fresh();
      if (r.status === "sent") s.sent++;
      bySender.set(c.sender_id, s);
    }
    const niche = nicheOf.get(r.lead_id) ?? "—";
    const n = byNiche.get(niche) ?? fresh();
    if (r.status === "sent") n.sent++;
    byNiche.set(niche, n);
  }
  for (const e of events ?? []) {
    const r = recOf.get(e.recipient_id) as any;
    if (!r) continue;
    const apply = (row: Row | undefined) => {
      if (!row) return;
      if (e.type === "delivered") row.delivered.add(e.recipient_id);
      if (e.type === "opened") row.opened.add(e.recipient_id);
      if (e.type === "clicked") row.clicked.add(e.recipient_id);
      if (e.type === "bounced") row.bounced.add(e.recipient_id);
      if (e.type === "replied") row.replied.add(e.recipient_id);
      if (e.type === "complained") row.complained.add(e.recipient_id);
    };
    apply(byCampaign.get(e.campaign_id));
    const c = campOf.get(e.campaign_id) as any;
    if (c?.sender_id) apply(bySender.get(c.sender_id));
    apply(byNiche.get(nicheOf.get(r.lead_id) ?? "—"));
  }
  const senderName = (id: string) => {
    const s = (senders ?? []).find((x: any) => x.id === id) as any;
    return s ? `${s.name} (${s.from_email})` : "—";
  };
  const render = (title: string, entries: [string, Row][], label: (id: string) => string) => (
    <section className="panel table-wrap">
      <h2 className="mb-2 font-bold">{title}</h2>
      {!entries.length ? <p className="muted text-sm">No data yet — send a campaign first.</p> : (
        <table className="tbl"><thead><tr><th>{title}</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Replied</th><th>Bounced</th></tr></thead><tbody>
          {entries.map(([id, row]) => {
            const base = row.delivered.size || row.sent;
            return <tr key={id}><td className="font-semibold">{label(id)}</td>
              <td>{row.sent}</td><td>{row.delivered.size}</td>
              <td>{row.opened.size} ({pct(row.opened.size, base)})</td>
              <td>{row.clicked.size} ({pct(row.clicked.size, base)})</td>
              <td>{row.replied.size} ({pct(row.replied.size, base)})</td>
              <td>{row.bounced.size}{row.complained.size ? ` · ${row.complained.size} complaints` : ""}</td></tr>;
          })}
        </tbody></table>)}
    </section>
  );
  return (
    <div className="space-y-4">
      <PageHead icon="chart" title="Email analytics" subtitle="Open, click, reply and bounce rates. Opens count each recipient once, even if they open twice.">
        <Link href="/dashboard/email" className="btn"><Icon n="mail" /> Back to Email</Link>
      </PageHead>
      {render("By campaign", [...byCampaign.entries()].sort((a, b) => b[1].sent - a[1].sent),
        (id) => { const c = campOf.get(id) as any; return c ? `${c.name || c.subject}` : id; })}
      {render("By sender", [...bySender.entries()], senderName)}
      {render("By niche", [...byNiche.entries()].sort((a, b) => b[1].sent - a[1].sent), (id) => id)}
      <p className="muted text-sm">Tracking needs the pixel and tracked links in sent emails (on by default per campaign). Replies counted here include both automatic detection (Resend inbound, when configured) and manual “Mark replied”.</p>
    </div>
  );
}
