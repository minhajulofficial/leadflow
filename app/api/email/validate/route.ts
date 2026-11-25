import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/email/validate";
import { json, sameOriginJson } from "@/lib/http";

/** Check addresses before sending: syntax + MX records. Signed in only. */
export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const emails = Array.isArray(b?.emails) ? b.emails.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  if (!emails.length) return json({ error: "No addresses to check." }, 400);
  const results = await Promise.all(emails.map((e: string) => validateEmail(e)));
  return json({ results });
}
