import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import IntegrationsClient from "./integrations-client";

export default async function Integrations() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: providers }, { data: settings }] = await Promise.all([
    supabase.from("providers").select("slug, name, description").eq("enabled", true).order("name"),
    supabase.from("user_provider_settings").select("provider_slug, enabled, has_key"),
  ]);
  return (
    <div>
      <PageHead icon="plug" title="Integrations" subtitle="Connect your own provider account. Scraping costs are billed to you by the provider, and your key is stored encrypted." />
      <IntegrationsClient providers={providers ?? []} settings={settings ?? []} />
    </div>
  );
}
