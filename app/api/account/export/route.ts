import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAccountExport, type ExportRow } from "@/lib/account";
import { checkRateLimit, rateLimitKey, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Full account export (PRD NFR-L4). Signed-in GET -> a JSON download of
 * everything the user owns. Reads through the user's own client, so RLS
 * enforces ownership — no service-role key involved. Encrypted credentials
 * are stripped (see lib/account.ts); the audit log is not included (it
 * belongs to the service, not the account).
 */
const EXPORT_TABLES = [
  "profiles",
  "leads",
  "lead_runs",
  "payments",
  "user_provider_settings",
  "sender_accounts",
  "templates",
  "campaigns",
  "campaign_recipients",
  "email_queue",
  "email_events",
  "suppression_list",
  "ai_keys",
] as const;

export async function GET(req: Request) {
  const rl = checkRateLimit(rateLimitKey(req, "account-export"), RATE_LIMITS.accountExport);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const sections: Record<string, ExportRow[]> = {};
  for (const table of EXPORT_TABLES) {
    const col = table === "profiles" ? "id" : "user_id";
    const { data, error } = await supabase.from(table).select("*").eq(col, user.id);
    if (error) return Response.json({ error: "Export failed. Please try again later." }, { status: 500 });
    sections[table] = (data ?? []) as ExportRow[];
  }
  const file = buildAccountExport({ id: user.id, email: user.email }, sections);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="leadflow-export-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
