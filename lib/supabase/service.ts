import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service-role key. It bypasses RLS.
 *
 * Used in server routes ONLY, never in the browser, never in logs. The
 * caller has no login session (a recipient opening an email, Resend
 * delivering a webhook, the cron worker, or a user deleting their own
 * account), so RLS cannot admit them; the signed token / Svix signature /
 * user session IS the authorization and the service client is only the
 * mechanism. Routes using it (Phase 8):
 *  - app/api/email/queue/process (cron mode: send queued mail for all users)
 *  - app/api/email/unsubscribe (write a suppression row without a login)
 *  - app/api/email/track/open, app/api/email/track/click (record an event)
 *  - app/api/email/webhooks/resend, app/api/email/webhooks/resend-inbound
 *  - app/api/account/delete (delete the caller's own rows across tables)
 * The key lives only as a Cloudflare Secret (SUPABASE_SERVICE_ROLE_KEY).
 * If it is missing, those routes fail closed.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SERVICE_ROLE_KEY_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
