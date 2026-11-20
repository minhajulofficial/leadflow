import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Admin pages need: logged in + role admin + 2-step verification done in this session (aal2). */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard?notice=not-admin");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/admin/mfa");
  return { supabase, user };
}
