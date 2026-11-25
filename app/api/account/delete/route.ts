import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { json, sameOriginJson } from "@/lib/http";
import { checkRateLimit, rateLimitKey, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import {
  ACCOUNT_DELETE_TABLES,
  DELETE_CONFIRM_WORD,
  deletedPlaceholderEmail,
} from "@/lib/account";

/**
 * Account deletion (PRD NFR-L4). Signed-in POST { confirm: "DELETE" }.
 *
 * What happens, in order:
 *  1. Last-admin rule: an admin who is the only admin cannot delete
 *     themselves. A second admin must exist first.
 *  2. An audit row records the deletion (actor + plan).
 *  3. All user-owned rows are deleted (see ACCOUNT_DELETE_TABLES in
 *     lib/account.ts) via the service-role client — the user has no RLS
 *     path to delete across every table, and the caller IS the owner.
 *  4. RETAINED on purpose: payments + audit_logs (refund window proof).
 *  5. The auth login is anonymised (email -> deleted placeholder) and
 *     permanently banned — NOT removed from Auth, because every user table
 *     references auth.users(id) ON DELETE CASCADE and deleting the auth
 *     user would wipe the retained payment rows. The original email address
 *     is freed and can sign up fresh.
 * The UI signs the user out after a successful response.
 */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 400);
  const rl = checkRateLimit(rateLimitKey(req, "account-delete"), RATE_LIMITS.accountDelete);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  let body: { confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  if (body.confirm !== DELETE_CONFIRM_WORD) {
    return json({ error: `Type ${DELETE_CONFIRM_WORD} to confirm deletion.` }, 400);
  }

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return json({ error: "Account deletion is not configured on this server yet." }, 503);
  }

  const { data: profile } = await db.from("profiles").select("role, plan").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") {
    const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return json({ error: "You are the only admin. Make another user an admin first, then delete this account." }, 403);
    }
  }

  await db.from("audit_logs").insert({
    actor: user.id,
    action: "account_deleted",
    detail: { plan: profile?.plan ?? "unknown" },
  });

  for (const table of ACCOUNT_DELETE_TABLES) {
    const col = table === "profiles" ? "id" : "user_id";
    const { error } = await db.from(table).delete().eq(col, user.id);
    if (error) return json({ error: "Deletion failed part-way. Please contact support." }, 500);
  }

  const placeholder = deletedPlaceholderEmail(user.id);
  const { error: adminError } = await db.auth.admin.updateUserById(user.id, {
    email: placeholder,
    ban_duration: "876000h",
    user_metadata: {},
  });
  if (adminError) return json({ error: "Deletion failed part-way. Please contact support." }, 500);

  return json({ ok: true, deleted: true });
}
