import { requireAdmin } from "@/lib/admin";
import AdminNav from "../admin-nav";
import CollectEditor from "./collect-editor";

export default async function AdminCollect() {
  const { supabase } = await requireAdmin();
  const [{ data: providers }, { data: directories }, { data: countries }, { data: cities }] = await Promise.all([
    supabase.from("providers").select("slug, name, enabled").order("name"),
    supabase.from("directories").select("id, name, provider_slug, active").order("name"),
    supabase.from("countries").select("code, name").order("name"),
    supabase.from("cities").select("id, name, country_code").order("name"),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AdminNav />
      <CollectEditor providers={providers ?? []} directories={directories ?? []} countries={countries ?? []} cities={cities ?? []} />
    </main>
  );
}
