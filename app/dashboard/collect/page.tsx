import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">Collect leads</span>
        <div className="flex gap-2"><Link href="/dashboard/integrations" className="btn">Integrations</Link><Link href="/dashboard/leads" className="btn">My leads</Link></div>
      </header>
      <CollectClient providers={ready} directories={directories ?? []} countries={countries ?? []} cities={cities ?? []}
                     initialRuns={runs ?? []} maxPerRun={limits?.max_per_run ?? 20} />
    </main>
  );
}
