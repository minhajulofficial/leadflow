import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { apifyMessage, startRun } from "@/lib/apify";
import { buildApifyInput, validateStart } from "@/lib/collect";
import { json, sameOriginJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!sameOriginJson(req)) return json({ error: "Bad request." }, 403);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);

  const { data: limits } = await supabase.rpc("my_plan_limits");
  const v = validateStart(await req.json().catch(() => null), limits?.max_per_run ?? 20);
  if (!v.ok) return json({ error: v.error }, 400);
  const b = v.value;

  const [{ data: provider }, { data: dir }, { data: country }, { data: cities }, { count: active }] = await Promise.all([
    supabase.from("providers").select("slug, actor, enabled").eq("slug", b.providerSlug).maybeSingle(),
    supabase.from("directories").select("id, provider_slug, active").eq("id", b.directoryId).maybeSingle(),
    supabase.from("countries").select("code, name").eq("code", b.countryCode).maybeSingle(),
    supabase.from("cities").select("id, name, country_code").in("id", b.cityIds),
    supabase.from("lead_runs").select("id", { count: "exact", head: true }).in("status", ["running", "importing"]),
  ]);
  if (!provider?.enabled) return json({ error: "This provider is switched off." }, 400);
  if (!dir?.active || dir.provider_slug !== provider.slug) return json({ error: "Directory not available for this provider." }, 400);
  if (!country || cities?.length !== b.cityIds.length || cities.some((c) => c.country_code !== country.code)) return json({ error: "Invalid country or city." }, 400);
  if ((active ?? 0) + cities.length > 5) return json({ error: "You have runs in progress. Wait for them to finish first." }, 429);

  const { data: enc } = await supabase.rpc("get_provider_key", { p_slug: provider.slug });
  if (!enc) return json({ error: "Turn on this provider and add your API key in Integrations first." }, 400);
  let token: string;
  try { token = await decryptSecret(enc, process.env.ENCRYPTION_KEY); }
  catch { return json({ error: "Could not read your saved key. Please save it again in Integrations." }, 500); }

  const started: string[] = [], errors: string[] = [];
  for (const city of cities) {
    try {
      const run = await startRun(token, provider.actor, buildApifyInput({ niches: b.niches, city: city.name, country: country.name, countryCode: country.code, max: b.max }));
      const { data: row, error } = await supabase.from("lead_runs").insert({
        provider_slug: provider.slug, label: `${b.niches.join(", ")} · ${city.name}`, external_run_id: run.id, dataset_id: run.defaultDatasetId,
        params: { ...b, country: { code: country.code, name: country.name }, city: { id: city.id, name: city.name } },
      }).select("id").single();
      if (error || !row) errors.push(`${city.name}: could not record run`); else started.push(row.id);
    } catch (e) { errors.push(`${city.name}: ${apifyMessage(e)}`); }
  }
  return json({ runs: started, errors }, started.length ? 200 : 400);
}
