import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import SuppressionClient from "./suppression-client";

export default async function Suppression() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: rows } = await supabase.from("suppression_list").select("*").order("created_at", { ascending: false }).limit(500);
  return (
    <div>
      <PageHead icon="no" title="Suppression list" subtitle="Addresses that will never be emailed again — unsubscribed, bounced, or complained. Removing one lets future campaigns send to it again." />
      <SuppressionClient initial={rows ?? []} />
    </div>
  );
}
