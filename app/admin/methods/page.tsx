import { requireAdmin } from "@/lib/admin";
import PageHead from "@/components/page-head";
import MethodsEditor from "./methods-editor";

export default async function Methods() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("payment_methods").select("*").order("name");
  return (
    <div>
      <PageHead icon="wallet" title="Payment methods" subtitle="Users only see methods that are Active. Set your real number, then switch it on." />
      <MethodsEditor initial={data ?? []} />
    </div>
  );
}
