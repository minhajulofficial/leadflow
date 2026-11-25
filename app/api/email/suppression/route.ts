import { createClient } from "@/lib/supabase/server";
import { json, sameOriginJson } from "@/lib/http";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data } = await supabase.from("suppression_list").select("*").order("created_at", { ascending: false }).limit(500);
  return json({ suppressed: data ?? [] });
}

export async function DELETE(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string") return json({ error: "Bad request." }, 400);
  await supabase.from("suppression_list").delete().eq("id", b.id);
  return json({ ok: true });
}
