"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";
import { LEGAL } from "@/lib/legal";
import { DELETE_CONFIRM_WORD } from "@/lib/account";

export default function SettingsClient({ email, plan, isAdmin }: { email: string; plan: string; isAdmin: boolean }) {
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function doExport() {
    setExportMsg(null);
    setExportBusy(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg("Your export downloaded as a JSON file.");
    } catch {
      setExportMsg("Export failed. Please try again later.");
    }
    setExportBusy(false);
  }

  async function doDelete() {
    setDeleteMsg(null);
    if (confirm !== DELETE_CONFIRM_WORD) {
      setDeleteMsg({ ok: false, text: `Type ${DELETE_CONFIRM_WORD} to confirm.` });
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Deletion failed.");
      await createClient().auth.signOut();
      location.href = "/?deleted=1";
    } catch (e) {
      setDeleteMsg({ ok: false, text: e instanceof Error ? e.message : "Deletion failed." });
    }
    setDeleteBusy(false);
  }

  return (
    <div className="space-y-6">
      <section className="panel space-y-3">
        <h2 className="text-lg font-bold">Your account</h2>
        <p className="muted text-sm">Signed in as <strong>{email}</strong> · Plan: <strong>{plan}</strong>{isAdmin ? " · Admin" : ""}</p>
        <p className="muted text-sm">
          Support: {LEGAL.supportEmail} · <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          {" · "}<Link href="/terms" className="underline underline-offset-2">Terms</Link>
          {" · "}<Link href="/refund" className="underline underline-offset-2">Refund Policy</Link>
        </p>
      </section>

      <section className="panel space-y-3">
        <h2 className="text-lg font-bold">Export my data</h2>
        <p className="muted text-sm">
          Download everything you own — profile, leads, runs, payments, provider settings (without keys),
          senders, templates, campaigns, recipients, email events, and suppression entries — as one JSON file.
          Encrypted provider keys are never included in an export.
        </p>
        <div><button className="btn" onClick={doExport} disabled={exportBusy}>
          <Icon n="download" /> {exportBusy ? "Preparing…" : "Download my data (JSON)"}
        </button></div>
        {exportMsg && <p className="text-sm" role="status">{exportMsg}</p>}
      </section>

      <section className="panel space-y-3" style={{ borderColor: "var(--bad)" }}>
        <h2 className="text-lg font-bold text-[var(--bad)]">Delete my account</h2>
        <p className="text-sm">This is permanent. It deletes:</p>
        <ul className="list-disc pl-5 text-sm">
          <li>Your profile, leads, collection runs, and provider keys</li>
          <li>Your senders, templates, campaigns, recipients, queued mail, email events, suppression list, and AI keys</li>
          <li>Your sign-in (the login is anonymised and permanently banned, so your email address can sign up fresh later)</li>
        </ul>
        <p className="text-sm">
          Kept on purpose: your <strong>payment records</strong> (plan, amount, TrxID, decision) for the
          refund window, and the <strong>audit log</strong> entry recording the deletion. Nothing else is kept.
        </p>
        {isAdmin && (
          <p className="text-sm" role="note">
            You are an admin. If you are the only admin, deletion is blocked until another user is made an admin.
          </p>
        )}
        <label className="label" htmlFor="delete-confirm">
          Type {DELETE_CONFIRM_WORD} to confirm
        </label>
        <input
          id="delete-confirm"
          className="field w-full max-w-xs"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={DELETE_CONFIRM_WORD}
          autoComplete="off"
        />
        <div>
          <button className="btn btn-danger" onClick={doDelete} disabled={deleteBusy || confirm !== DELETE_CONFIRM_WORD}>
            <Icon n="trash" /> {deleteBusy ? "Deleting…" : "Delete my account permanently"}
          </button>
        </div>
        {deleteMsg && (
          <p className={`text-sm ${deleteMsg.ok ? "" : "text-[var(--bad)]"}`} role="status">{deleteMsg.text}</p>
        )}
      </section>
    </div>
  );
}
