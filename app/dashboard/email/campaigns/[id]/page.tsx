import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import CampaignClient from "./campaign-client";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) redirect("/dashboard/email");
  const [{ data: recipients }, { data: sender }, { data: usageRows }] = await Promise.all([
    supabase.from("campaign_recipients").select("id, email, name, company, status, attempts, last_error, sent_at, created_at")
      .eq("campaign_id", id).order("created_at").limit(500),
    campaign.sender_id
      ? supabase.from("sender_accounts").select("id, name, from_email, active").eq("id", campaign.sender_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("my_email_usage"),
  ]);
  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  return (
    <div>
      <PageHead icon="mail" title={campaign.name || campaign.subject} subtitle={`Created ${new Date(campaign.created_at).toLocaleString()} · Sender: ${sender?.name ?? "—"} (${sender?.from_email ?? "no sender"})`} />
      <CampaignClient campaign={campaign} sender={sender ?? null} recipients={recipients ?? []} usage={usage ?? null} />
    </div>
  );
}
