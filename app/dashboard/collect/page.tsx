import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import PageHead from "@/components/page-head";
import CollectClient from "./collect-client";

export default async function Collect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: providers }, { data: settings }, { data: directories }, { data: countries }, { data: cities }, { data: runs }, { data: limits }] = await Promise.all([
    supabase.from("providers").select("slug, name").eq("enabled", true).order("name"),
    supabase.from("user_provider_settings").select("provider_slug, enabled, has_key"),
    supabase.from("directories").select("id, name, provider_slug").eq("active", true).order("name"),
    supabase.from("countries").select("code, name").order("name"),
    supabase.from("cities").select("id, name, country_code").order("name"),
    supabase.from("lead_runs").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.rpc("my_plan_limits"),
  ]);
  const ready = (providers ?? []).filter((p) => settings?.some((s) => s.provider_slug === p.slug && s.enabled && s.has_key));
  return (
    <div>
      <PageHead icon="collect" title="Collect leads" subtitle="Tell us who to look for and where. New leads are saved to My leads automatically.">
        <Link href="/dashboard/integrations" className="btn"><Icon n="plug" /> Integrations</Link>
        <Link href="/dashboard/leads" className="btn"><Icon n="leads" /> My leads</Link>
      </PageHead>
      <CollectClient providers={ready} directories={directories ?? []} countries={countries ?? []} cities={cities ?? []} initialRuns={runs ?? []} maxPerRun={limits?.max_per_run ?? 20} />
    </div>
  );
}
