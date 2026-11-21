import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import LeadsClient from "./leads-client";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("my_lead_usage");
  const usage = Array.isArray(data) ? data[0] : data;
  return (
    <div>
      <PageHead icon="leads" title="My leads" subtitle="Everything you have collected or added. Search, filter, import and export." />
      <LeadsClient used={usage?.used ?? 0} limit={usage?.lim ?? null} />
    </div>
  );
}
