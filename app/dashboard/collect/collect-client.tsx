"use client";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useEffect, useRef, useState } from "react";

type Run = { id: string; label: string | null; status: string; found: number; added: number; skipped: number; duplicates: number; error: string | null; created_at: string };
type Props = {
  providers: { slug: string; name: string }[]; directories: { id: string; name: string; provider_slug: string }[];
  countries: { code: string; name: string }[]; cities: { id: string; name: string; country_code: string }[];
  initialRuns: Run[]; maxPerRun: number;
};

export default function CollectClient({ providers, directories, countries, cities, initialRuns, maxPerRun }: Props) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [provider, setProvider] = useState(providers[0]?.slug ?? "");
  const dirs = directories.filter((d) => d.provider_slug === provider);
  const [directory, setDirectory] = useState("");
  const [niches, setNiches] = useState("");
  const [country, setCountry] = useState(countries.find((c) => c.code === "bd")?.code ?? countries[0]?.code ?? "");
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [max, setMax] = useState(Math.min(20, maxPerRun));
  const [rules, setRules] = useState({ requireEmail: false, requirePhone: true, requireWebsite: false });
  const [minRating, setMinRating] = useState(""); const [minReviews, setMinReviews] = useState(""); const [maxReviews, setMaxReviews] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const polling = useRef(false);
  const countryCities = cities.filter((c) => c.country_code === country);

  useEffect(() => { setDirectory(dirs[0]?.id ?? ""); }, [provider]);          // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setCityIds([]); }, [country]);

  useEffect(() => {
    const active = runs.some((r) => r.status === "running" || r.status === "importing");
    if (!active) return;
    const t = setInterval(async () => {
      if (polling.current) return; polling.current = true;
      try {
        const updated = await Promise.all(runs.filter((r) => r.status === "running" || r.status === "importing").map(async (r) => {
          const res = await fetch(`/api/collect/status?id=${r.id}`); const j: any = await res.json().catch(() => ({}));
          return (j.run as Run) ?? r;
        }));
        setRuns((cur) => cur.map((r) => updated.find((u) => u.id === r.id) ?? r));
      } finally { polling.current = false; }
    }, 5000);
    return () => clearInterval(t);
  }, [runs]);

  async function start() {
    setBusy(true); setMsg(null);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const res = await fetch("/api/collect/start", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerSlug: provider, directoryId: directory, niches: niches.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
        countryCode: country, cityIds, max, rules, minRating: num(minRating), minReviews: num(minReviews), maxReviews: num(maxReviews) }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ ok: false, text: j.error ?? (j.errors?.join(" ") || "Could not start.") });
    else {
      setMsg({ ok: true, text: `Started ${j.runs.length} run(s). Results appear below and are saved to My leads automatically.${j.errors?.length ? " Some failed: " + j.errors.join("; ") : ""}` });
      location.reload();
    }
    setBusy(false);
  }

  if (!providers.length) return (
    <section className="panel text-center">
      <div className="empty"><span className="icon-chip"><Icon n="plug" /></span>
        <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>Connect your Apify account first</p>
        <p className="mx-auto mt-1 max-w-md text-sm">Automatic collection runs on your own Apify account. It takes a minute: paste your API token once and you are ready.</p>
        <Link href="/dashboard/integrations" className="btn btn-primary mt-5">Go to Integrations <Icon n="arrow" /></Link></div>
    </section>
  );

  const stepHead = (n: number, t: string, sub: string) => (<div className="mb-4 flex items-center gap-3"><span className="icon-chip sm font-extrabold">{n}</span><div><h2 className="font-bold">{t}</h2><p className="muted text-sm">{sub}</p></div></div>);
  const running = (s: string) => s === "running" || s === "importing";
  return (
    <div className="space-y-4">
      <section className="panel">
        {stepHead(1, "What are you looking for?", "Choose where to search and the type of business.")}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="prov">Provider</label><select id="prov" className="field" value={provider} onChange={(e) => setProvider(e.target.value)}>{providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="dir">Directory</label><select id="dir" className="field" value={directory} onChange={(e) => setDirectory(e.target.value)}>{dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="md:col-span-2"><label className="label" htmlFor="niches">Niches <span className="muted font-normal">(comma separated, up to 5)</span></label>
            <div className="field-icon"><Icon n="tag" /><input id="niches" className="field" placeholder="dentist, digital marketing agency, cafe" value={niches} onChange={(e) => setNiches(e.target.value)} /></div></div>
        </div>
      </section>

      <section className="panel">
        {stepHead(2, "Where?", "Pick a country, then up to 5 cities. Each city runs as its own search.")}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="country">Country</label><select id="country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="max">Results per city <span className="muted font-normal">(max {maxPerRun} on your plan)</span></label>
            <input id="max" className="field" type="number" min={1} max={maxPerRun} value={max} onChange={(e) => setMax(Number(e.target.value))} /></div>
          <div className="md:col-span-2"><p className="label">Cities <span className="muted font-normal">· {cityIds.length} selected</span></p>
            <div className="flex flex-wrap gap-2">
              {countryCities.map((c) => { const on = cityIds.includes(c.id); return (
                <button type="button" key={c.id} className={on ? "btn btn-primary !py-1.5" : "btn !py-1.5"} aria-pressed={on}
                  onClick={() => setCityIds(on ? cityIds.filter((x) => x !== c.id) : cityIds.length < 5 ? [...cityIds, c.id] : cityIds)}>{on && <Icon n="check" />}{c.name}</button>); })}
            </div></div>
        </div>
      </section>

      <section className="panel">
        {stepHead(3, "Keep only the good ones", "Leads that do not match are dropped before they count against your plan.")}
        <div className="flex flex-wrap gap-2">
          {([["requirePhone", "Has phone", "phone"], ["requireWebsite", "Has website", "globe"], ["requireEmail", "Has email", "mail"]] as const).map(([k, l, ic]) => (
            <button type="button" key={k} aria-pressed={rules[k]} className={rules[k] ? "btn btn-primary !py-1.5" : "btn !py-1.5"} onClick={() => setRules({ ...rules, [k]: !rules[k] })}><Icon n={ic} />{l}</button>))}
        </div>
        {rules.requireEmail && <div className="alert alert-warn mt-3"><Icon n="warn" /><span>Google Maps rarely lists emails, so most results may be dropped with this on.</span></div>}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="mr">Minimum rating (0-5)</label><div className="field-icon"><Icon n="star" /><input id="mr" className="field" inputMode="decimal" placeholder="e.g. 4" value={minRating} onChange={(e) => setMinRating(e.target.value)} /></div></div>
          <div><label className="label" htmlFor="mnr">Min reviews</label><input id="mnr" className="field" inputMode="numeric" value={minReviews} onChange={(e) => setMinReviews(e.target.value)} /></div>
          <div><label className="label" htmlFor="mxr">Max reviews</label><input id="mxr" className="field" inputMode="numeric" value={maxReviews} onChange={(e) => setMaxReviews(e.target.value)} /></div>
        </div>
      </section>

      <section className="panel">
        <button className="btn btn-primary btn-lg" disabled={busy || !niches.trim() || !cityIds.length || !directory} onClick={start}>
          {busy ? <><Icon n="spinner" spin /> Starting…</> : <><Icon n="rocket" /> Start collecting ({cityIds.length || 0} search{cityIds.length === 1 ? "" : "es"})</>}</button>
        <p className="muted mt-3 text-xs">Billed to your own Apify account. Collect only public business data and follow each directory&apos;s terms and local laws.</p>
        {msg && <div role="status" className={`alert mt-3 ${msg.ok ? "alert-ok" : "alert-bad"}`}><Icon n={msg.ok ? "ok" : "no"} /><span>{msg.text}</span></div>}
      </section>

      <section className="panel">
        <h2 className="font-bold">Recent runs</h2>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead><tr><th>When</th><th>Search</th><th>Status</th><th>Found</th><th>Added</th><th>Filtered</th><th>Duplicates</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td><td>{r.label}</td>
                  <td>{running(r.status) ? <span className="badge badge-warn"><Icon n="spinner" spin /> {r.status}</span> : r.status === "succeeded" ? <span className="badge badge-ok"><Icon n="check" /> done</span> : <span className="badge badge-bad"><Icon n="x" /> failed</span>}
                    {r.error && <p className="muted mt-1 text-xs">{r.error}</p>}</td>
                  <td>{r.found}</td><td className="font-semibold">{r.added}</td><td>{r.skipped}</td><td>{r.duplicates}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {!runs.length && <div className="empty"><span className="icon-chip"><Icon n="collect" /></span><p>No runs yet. Your first one will show up here.</p></div>}
      </section>
    </div>
  );
}
