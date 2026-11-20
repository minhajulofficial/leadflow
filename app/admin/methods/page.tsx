import { requireAdmin } from "@/lib/admin";
import AdminNav from "../admin-nav";
import MethodsEditor from "./methods-editor";

export default async function Methods() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("payment_methods").select("*").order("name");
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AdminNav />
      <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>Users only see methods that are Active. Set your real number, then tick Active.</p>
      <MethodsEditor initial={data ?? []} />
    </main>
  );
}
