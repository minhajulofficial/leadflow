import { createClient } from "@/lib/supabase/server";
import { json, sameOriginJson } from "@/lib/http";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data } = await supabase.from("templates").select("*").order("name");
  return json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  const subject = typeof b?.subject === "string" ? b.subject.slice(0, 200) : "";
  const body = typeof b?.body === "string" ? b.body.slice(0, 50000) : "";
  if (!name || name.length > 80) return json({ error: "Give this template a short name." }, 400);
  if (!subject && !body) return json({ error: "A template needs a subject or a body." }, 400);
  const { data, error } = await supabase.from("templates")
    .insert({ name, subject, body }).select("id").single();
  if (error) return json({ error: "Could not save the template (name already used?)." }, 400);
  return json({ ok: true, id: data?.id });
}

export async function DELETE(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const b: any = await req.json().catch(() => null);
  if (typeof b?.id !== "string") return json({ error: "Bad request." }, 400);
  await supabase.from("templates").delete().eq("id", b.id);
  return json({ ok: true });
}
