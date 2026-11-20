import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeadsClient from "./leads-client";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("my_lead_usage");
  const usage = Array.isArray(data) ? data[0] : data;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">Leads</span>
        <Link href="/dashboard" className="btn">Back</Link>
      </header>
      <LeadsClient used={usage?.used ?? 0} limit={usage?.lim ?? null} />
    </main>
  );
}
