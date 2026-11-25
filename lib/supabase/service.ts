import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service-role key. It bypasses RLS.
 *
 * Used in EXACTLY two server routes, never in the browser, never in logs:
 *  - app/api/email/queue/process (cron mode: send queued mail for all users)
 *  - app/api/email/unsubscribe (write a suppression row without a login)
 *
 * This is a deliberate, narrow exception to PRD Appendix B ("service-role key
 * not used by the app"): the queue must run with no user session, and an
 * unsubscribe click has no login. The key lives only as a Cloudflare Secret
 * (SUPABASE_SERVICE_ROLE_KEY). If it is missing, those routes fail closed.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SERVICE_ROLE_KEY_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
