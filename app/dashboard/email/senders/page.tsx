import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import SendersClient from "./senders-client";

export default async function Senders() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: senders } = await supabase.from("sender_accounts")
    .select("id, provider, name, from_email, from_name, daily_limit, active, last_used_at, has_key, created_at")
    .order("created_at");
  const { data: usageRows } = await supabase.rpc("my_email_usage");
  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  return (
    <div>
      <PageHead icon="plug" title="Senders" subtitle="Connect your own Resend account. The API key is verified, then stored encrypted — it is never shown again." />
      <SendersClient initial={senders ?? []} planLimit={usage?.lim ?? null} />
    </div>
  );
}
