"use client";
import { useState } from "react";
import { Icon } from "@/components/icon";

type Recipient = { id: string; email: string; name: string | null; company: string | null; status: string; attempts: number; last_error: string | null; sent_at: string | null };

const BADGE: Record<string, string> = {
  pending: "badge", queued: "badge badge-warn", sending: "badge badge-warn",
  sent: "badge badge-ok", failed: "badge badge-bad", skipped: "badge", suppressed: "badge badge-bad",
};

export default function CampaignClient({ campaign, sender, recipients, usage }: {
  campaign: any; sender: any; recipients: Recipient[]; usage: { sent_today: number; lim: number | null } | null;
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
    setMsg({ ok: true, text: a === "test" ? `Test email sent to ${j.to}.` : a === "send" ? `Sending started — ${j.queued} email(s) queued${j.skippedSuppressed ? `, ${j.skippedSuppressed} unsubscribed skipped` : ""}. The queue delivers them even if you close this tab.` : `Campaign ${j.status ?? a}.` });
    setBusy(false);
    if (a !== "test") location.reload();
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

      <section className="panel table-wrap"><table className="tbl"><thead><tr><th>Recipient</th><th>Status</th><th>Tries</th><th>Error / sent</th></tr></thead><tbody>
        {recipients.map((r) => (
          <tr key={r.id}>
            <td><span className="font-semibold">{r.name ?? "—"}</span> <span className="muted">· {r.email}</span>{r.company ? <span className="muted"> · {r.company}</span> : ""}</td>
            <td><span className={BADGE[r.status] ?? "badge"}>{r.status}</span></td>
            <td>{r.attempts}</td>
            <td className="muted text-sm">{r.status === "sent" && r.sent_at ? new Date(r.sent_at).toLocaleString() : r.last_error ?? ""}</td>
          </tr>))}
        {!recipients.length && <tr><td colSpan={4} className="muted py-4 text-center">No recipients.</td></tr>}
      </tbody></table></section>
    </div>
  );
}
