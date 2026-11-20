import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">Integrations</span>
        <Link href="/dashboard" className="btn">Back</Link>
      </header>
      <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
        Auto lead collection runs on <strong>your own</strong> provider account, so the scraping cost is billed by the provider to you.
        Your key is encrypted and never shown again.
      </p>
      <IntegrationsClient providers={providers ?? []} settings={settings ?? []} />
    </main>
  );
}
