"use client";
import { useState } from "react";
import { Icon } from "@/components/icon";

type Recipient = { id: string; email: string; name: string | null; company: string | null; status: string; attempts: number; last_error: string | null; sent_at: string | null; opened_at: string | null; clicked_at: string | null; bounced_at: string | null; replied_at: string | null };
type TimelineEvent = { recipient_id: string; type: string; target_url: string | null; created_at: string };

const BADGE: Record<string, string> = {
  pending: "badge", queued: "badge badge-warn", sending: "badge badge-warn",
  sent: "badge badge-ok", failed: "badge badge-bad", skipped: "badge", suppressed: "badge badge-bad",
};

export default function CampaignClient({ campaign, sender, recipients, usage, events }: {
  campaign: any; sender: any; recipients: Recipient[]; usage: { sent_today: number; lim: number | null } | null; events: TimelineEvent[];
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");

  async function action(a: string, extra?: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/email/campaigns/${campaign.id}/send`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: a, ...extra }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Something went wrong." }); setBusy(false); return; }
    setMsg({ ok: true, text: a === "test" ? `Test email sent to ${j.to}.` : a === "send" ? `Sending started — ${j.queued} email(s) queued${j.skippedSuppressed ? `, ${j.skippedSuppressed} unsubscribed skipped` : ""}${j.skippedInvalid ? `, ${j.skippedInvalid} invalid address(es) skipped (no mail server)` : ""}. The queue delivers them even if you close this tab.` : `Campaign ${j.status ?? a}.` });
    setBusy(false);
    if (a !== "test") location.reload();
  }

  async function markReplied(id: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/email/recipients/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mark-replied" }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not mark as replied." }); setBusy(false); return; }
    setMsg({ ok: true, text: "Marked as replied." });
    setBusy(false);
    location.reload();
  }

  async function processNow() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/email/queue/process", { method: "POST" });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Could not process the queue." }); setBusy(false); return; }
    setMsg({ ok: true, text: `Queue pass done: ${j.sent} sent, ${j.failed} failed, ${j.skipped} skipped.` });
    setBusy(false);
    location.reload();
  }

  const counts = (s: string) => recipients.filter((r) => r.status === s).length;
  const canSend = ["draft", "scheduled", "paused"].includes(campaign.status);
  const canPause = ["sending", "scheduled"].includes(campaign.status);
  const timeline = (r: Recipient) => {
    const steps: string[] = [];
    if (r.sent_at) steps.push(`sent ${new Date(r.sent_at).toLocaleString()}`);
    if (r.opened_at) steps.push(`opened ${new Date(r.opened_at).toLocaleString()}`);
    if (r.clicked_at) steps.push(`clicked ${new Date(r.clicked_at).toLocaleString()}`);
    if (r.bounced_at) steps.push(`bounced ${new Date(r.bounced_at).toLocaleString()}`);
    if (r.replied_at) steps.push(`replied ${new Date(r.replied_at).toLocaleString()}`);
    return steps.join(" → ");
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`alert ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /> {msg.text}</p>}

      <section className="panel">
        <div className="flex flex-wrap items-center gap-3">
          <span className={BADGE[campaign.status] ?? "badge"}>{campaign.status}</span>
          <span className="muted text-sm">Sent today on your plan: {usage?.sent_today ?? 0} / {usage?.lim ?? "–"}</span>
          <span className="muted text-sm">{counts("sent")} sent · {counts("queued") + counts("sending")} in queue · {counts("failed")} failed · {counts("suppressed")} unsubscribed · {counts("pending")} waiting</span>
        </div>
        <div className="mt-4">
          <p className="muted text-sm">Subject</p><p className="font-bold">{campaign.subject}</p>
          <p className="muted mt-3 text-sm">Body</p>
          <div className="whitespace-pre-wrap rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>{campaign.body}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canSend && <button className="btn btn-primary" disabled={busy || !sender?.active} onClick={() => action("send")}><Icon n="send" /> Send now</button>}
          {canPause && <button className="btn" disabled={busy} onClick={() => action("pause")}><Icon n="clock" /> Pause</button>}
          {campaign.status === "paused" && <button className="btn btn-primary" disabled={busy} onClick={() => action("resume")}><Icon n="refresh" /> Resume</button>}
          {campaign.status === "sending" && <button className="btn" disabled={busy} onClick={processNow}><Icon n="bolt" /> Process my queue now</button>}
          <span className="flex items-center gap-2">
            <input className="field !w-56 !py-1.5" type="email" placeholder="Test to (default: your email)" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button className="btn" disabled={busy} onClick={() => action("test", testTo ? { to: testTo } : {})}><Icon n="mail" /> Send test</button>
          </span>
        </div>
        {campaign.status === "draft" && <p className="muted mt-3 text-sm">“Send now” queues every pending recipient. The queue worker (or “Process my queue now”) delivers them within your daily limit — even if you close this tab.</p>}
        {campaign.status === "sending" && <p className="muted mt-3 text-sm">Sending runs in the background. If no cron trigger is configured yet, use “Process my queue now” to send the next batch.</p>}
      </section>

      <section className="panel table-wrap"><table className="tbl"><thead><tr><th>Recipient</th><th>Status</th><th>Tries</th><th>Timeline</th><th></th></tr></thead><tbody>
        {recipients.map((r) => (
          <tr key={r.id}>
            <td><span className="font-semibold">{r.name ?? "—"}</span> <span className="muted">· {r.email}</span>{r.company ? <span className="muted"> · {r.company}</span> : ""}</td>
            <td><span className={BADGE[r.status] ?? "badge"}>{r.status}</span></td>
            <td>{r.attempts}</td>
            <td className="muted text-sm">{timeline(r) || r.last_error || ""}</td>
            <td>{r.status === "sent" && !r.replied_at && (
              <button className="btn !px-2 !py-0.5 !text-xs" disabled={busy} onClick={() => markReplied(r.id)}>Mark replied</button>)}</td>
          </tr>))}
        {!recipients.length && <tr><td colSpan={5} className="muted py-4 text-center">No recipients.</td></tr>}
      </tbody></table></section>

      {events.length > 0 && (
        <section className="panel">
          <h2 className="mb-2 font-bold">Recent activity</h2>
          <ul className="space-y-1 text-sm">
            {events.slice(0, 20).map((e, i) => {
              const r = recipients.find((x) => x.id === e.recipient_id);
              return <li key={`${e.recipient_id}-${e.type}-${i}`}><span className="muted">{new Date(e.created_at).toLocaleString()}</span> · <strong>{e.type}</strong> · {r?.email ?? e.recipient_id}{e.target_url ? <> → <span className="muted">{e.target_url.slice(0, 80)}</span></> : ""}</li>;
            })}
          </ul>
        </section>)}
    </div>
  );
}
