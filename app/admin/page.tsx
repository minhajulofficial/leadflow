import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: users } = await supabase
    .from("profiles").select("id, email, role, plan, created_at")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">Admin</span>
        <Link href="/dashboard" className="btn">Back to app</Link>
      </header>
      <section className="mt-8 panel overflow-x-auto">
        <h1 className="text-xl font-bold">Users ({users?.length ?? 0})</h1>
        <table className="mt-4 w-full text-left text-sm">
          <thead style={{ color: "var(--muted)" }}>
            <tr><th className="py-2">Email</th><th>Role</th><th>Plan</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2">{u.email}</td><td>{u.role}</td><td>{u.plan}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
