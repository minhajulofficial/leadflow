import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import NewCampaignClient from "./new-campaign-client";

export default async function NewCampaign() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: senders }, { data: templates }, { data: leads }] = await Promise.all([
    supabase.from("sender_accounts").select("id, name, from_email, active, has_key").eq("active", true).order("name"),
    supabase.from("templates").select("id, name, subject, body").order("name"),
    supabase.from("leads").select("id, name, company, city, country, email").not("email", "is", null).order("created_at", { ascending: false }).limit(200),
  ]);
  return (
    <div>
      <PageHead icon="mail" title="New campaign" subtitle="Pick leads with an email address, write with {{name}}-style merge fields, preview, then send or schedule." />
      <NewCampaignClient
        senders={(senders ?? []).filter((s: any) => s.has_key)}
        templates={templates ?? []}
        leads={(leads ?? []).filter((l: any) => l.email)}
      />
    </div>
  );
}
