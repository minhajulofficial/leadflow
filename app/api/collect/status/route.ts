import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { apifyMessage, getItems, getRun } from "@/lib/apify";
import { apifyState, processItems } from "@/lib/collect";
import { insertLeads } from "@/lib/insert-leads";
import { json } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return json({ error: "Bad request." }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);

  const { data: run } = await supabase.from("lead_runs").select("*").eq("id", id).maybeSingle();   // RLS: own runs only
  if (!run) return json({ error: "Run not found." }, 404);
  if (run.status !== "running") return json({ run });

  const fail = async (msg: string) => {
    const { data } = await supabase.from("lead_runs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", id).select("*").single();
    return json({ run: data });
  };

  const { data: enc } = await supabase.rpc("get_provider_key", { p_slug: run.provider_slug });
  if (!enc) return json({ run, note: "Provider is switched off or the key was removed." });
  let token: string;
  try { token = await decryptSecret(enc, process.env.ENCRYPTION_KEY); } catch { return fail("Could not read your saved API key."); }

  let state;
  try { state = apifyState((await getRun(token, run.external_run_id)).status); }
  catch (e) { return json({ run, note: apifyMessage(e) }); }          // temporary problem: keep the run, try again next poll
  if (state === "running") return json({ run });
  if (state === "failed") return fail("The Apify run did not finish successfully.");

  // finished: claim the import exactly once (a second poll cannot import again)
  const { data: claimed } = await supabase.from("lead_runs").update({ status: "importing" }).eq("id", id).eq("status", "running").select("*").maybeSingle();
  if (!claimed) return json({ run });
  try {
    const p = run.params;
    const items = await getItems(token, run.dataset_id, p.max + 50);
    const r = processItems(items, { country: p.country.name, city: p.city.name }, p, p.max);
    const ins = await insertLeads(supabase, r.leads, "auto");
    const { data: done } = await supabase.from("lead_runs").update({
      status: "succeeded", found: r.found, added: ins.added, skipped: r.filtered, duplicates: ins.dup, finished_at: new Date().toISOString(),
      error: ins.limitHit ? "Monthly plan limit reached. Upgrade to Pro to save more leads." : null,
    }).eq("id", id).select("*").single();
    return json({ run: done });
  } catch (e) { return fail(apifyMessage(e)); }
}
