import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TwoStepClient from "./two-step-client";

export default async function TwoStep() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/dashboard?notice=not-admin");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/admin");
  return <TwoStepClient />;
}
