import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import DeliverabilityClient from "./deliverability-client";

export default async function Deliverability() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="space-y-4">
      <PageHead icon="shield" title="Deliverability checker" subtitle="Check SPF, DKIM and DMARC for your sending domain, plus warm-up guidance and spam-risk hints." />
      <DeliverabilityClient />
    </div>
  );
}
