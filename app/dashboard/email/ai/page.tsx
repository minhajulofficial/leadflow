import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import AiClient from "./ai-client";

export default async function AiWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: keys } = await supabase.from("ai_keys").select("id, provider, active, has_key, created_at").order("created_at");
  return (
    <div className="space-y-4">
      <PageHead icon="magic" title="AI writer" subtitle="Draft and improve campaign emails with your own Gemini or OpenAI key. The key is encrypted and never shown again." />
      <AiClient initial={keys ?? []} />
    </div>
  );
}
