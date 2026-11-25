import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHead from "@/components/page-head";
import TemplatesClient from "./templates-client";

export default async function Templates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: templates } = await supabase.from("templates").select("*").order("name");
  return (
    <div>
      <PageHead icon="save" title="Templates" subtitle="Reusable subject + body. Use one when you start a campaign." />
      <TemplatesClient initial={templates ?? []} />
    </div>
  );
}
