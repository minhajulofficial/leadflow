import { createClient } from "@/lib/supabase/server";
import { APP_VERSION } from "@/lib/site";

/**
 * Health check for uptime monitors (see SETUP.md "Monitoring").
 * GET /api/health -> { ok, version, time, db }.
 * The DB ping is a cheap head-count on profiles through the anon client;
 * RLS means it returns 0 rows, which is fine — an error means the DB or
 * the env is broken. Never leaks error text or config.
 */
export async function GET() {
  let db: "ok" | "error" | "unconfigured" = "ok";
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      db = "unconfigured";
    } else {
      const supabase = await createClient();
      const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1);
      if (error) db = "error";
    }
  } catch {
    db = "error";
  }
  return Response.json(
    { ok: db !== "error", version: APP_VERSION, time: new Date().toISOString(), db },
    { status: db === "error" ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
