"use client";
import Link from "next/link";
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
    <section className="panel mt-6">
      <p>To collect leads automatically, add your Apify API key first.</p>
      <Link href="/dashboard/integrations" className="btn btn-primary mt-4">Go to Integrations</Link>
    </section>
  );

  const label = (t: string) => <label className="text-sm font-semibold">{t}</label>;
  return (
    <>
      <section className="panel mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-1">{label("Provider")}<select className="field" value={provider} onChange={(e) => setProvider(e.target.value)}>{providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></div>
        <div className="space-y-1">{label("Directory")}<select className="field" value={directory} onChange={(e) => setDirectory(e.target.value)}>{dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="space-y-1 md:col-span-2">{label("Niches (comma separated, up to 5)")}<input className="field" placeholder="dentist, digital marketing agency, cafe" value={niches} onChange={(e) => setNiches(e.target.value)} /></div>
        <div className="space-y-1">{label("Country")}<select className="field" value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
        <div className="space-y-1">{label(`Results per city (max ${maxPerRun} on your plan)`)}<input className="field" type="number" min={1} max={maxPerRun} value={max} onChange={(e) => setMax(Number(e.target.value))} /></div>
        <div className="space-y-1 md:col-span-2">{label(`Cities (choose up to 5) · ${cityIds.length} selected`)}
          <div className="flex flex-wrap gap-2">
            {countryCities.map((c) => { const on = cityIds.includes(c.id); return (
              <button type="button" key={c.id} className={on ? "btn btn-primary" : "btn"} aria-pressed={on}
                onClick={() => setCityIds(on ? cityIds.filter((x) => x !== c.id) : cityIds.length < 5 ? [...cityIds, c.id] : cityIds)}>{c.name}</button>); })}
          </div>
        </div>
        <div className="md:col-span-2 space-y-2">
          {label("Keep only leads that have")}
          <div className="flex flex-wrap gap-4 text-sm">
            {([["requirePhone", "Phone"], ["requireWebsite", "Website"], ["requireEmail", "Email"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.checked })} />{l}</label>))}
          </div>
          {rules.requireEmail && <p className="text-xs" style={{ color: "#b7791f" }}>Google Maps rarely lists emails, so most results may be dropped with this on.</p>}
        </div>
        <div className="space-y-1">{label("Minimum rating (0-5)")}<input className="field" inputMode="decimal" placeholder="e.g. 4" value={minRating} onChange={(e) => setMinRating(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">{label("Min reviews")}<input className="field" inputMode="numeric" value={minReviews} onChange={(e) => setMinReviews(e.target.value)} /></div>
          <div className="space-y-1">{label("Max reviews")}<input className="field" inputMode="numeric" value={maxReviews} onChange={(e) => setMaxReviews(e.target.value)} /></div>
        </div>
        <div className="md:col-span-2">
          <button className="btn btn-primary" disabled={busy || !niches.trim() || !cityIds.length || !directory} onClick={start}>{busy ? "Starting…" : `Start collecting (${cityIds.length || 0} city run${cityIds.length === 1 ? "" : "s"})`}</button>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Billed to your own Apify account. Collect only public business data and follow each directory&apos;s terms and local laws.</p>
          {msg && <p role="status" className="mt-2 text-sm" style={{ color: msg.ok ? "var(--accent)" : "#d64545" }}>{msg.text}</p>}
        </div>
      </section>

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="font-bold">Recent runs</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead style={{ color: "var(--muted)" }}><tr><th className="py-2">When</th><th>Search</th><th>Status</th><th>Found</th><th>Added</th><th>Filtered</th><th>Duplicates</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="py-2">{new Date(r.created_at).toLocaleString()}</td><td>{r.label}</td>
                <td>{r.status === "running" || r.status === "importing" ? "⏳ " + r.status : r.status}{r.error ? ` – ${r.error}` : ""}</td>
                <td>{r.found}</td><td>{r.added}</td><td>{r.skipped}</td><td>{r.duplicates}</td>
              </tr>))}
            {!runs.length && <tr><td colSpan={7} className="py-6 text-center" style={{ color: "var(--muted)" }}>No runs yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
