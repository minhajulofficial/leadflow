import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role, plan").eq("id", user.id).maybeSingle();

  return (
    <div className="space-y-6">
      <PageHead icon="sliders" title="Settings" subtitle="Your account, your data, and account deletion." />
      <SettingsClient email={user.email ?? ""} plan={p?.plan ?? "free"} isAdmin={p?.role === "admin"} />
    </div>
  );
}
