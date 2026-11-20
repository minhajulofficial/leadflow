"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  providers: { slug: string; name: string; enabled: boolean }[]; directories: { id: string; name: string; provider_slug: string; active: boolean }[];
  countries: { code: string; name: string }[]; cities: { id: string; name: string; country_code: string }[];
};

export default function CollectEditor({ providers, directories, countries, cities }: Props) {
  const supabase = createClient();
  const [msg, setMsg] = useState("");
  const [dirName, setDirName] = useState(""); const [dirProv, setDirProv] = useState(providers[0]?.slug ?? "");
  const [cc, setCc] = useState(""); const [cn, setCn] = useState("");
  const [cityCountry, setCityCountry] = useState(countries[0]?.code ?? ""); const [cityName, setCityName] = useState("");
  const done = (error: { message: string } | null) => (error ? setMsg(error.message) : location.reload());

  return (
    <div className="mt-6 space-y-4">
      {msg && <p role="alert" className="text-sm" style={{ color: "#d64545" }}>{msg}</p>}
      <section className="panel space-y-3"><h2 className="font-bold">Providers (on/off for all users)</h2>
        {providers.map((p) => (
          <label key={p.slug} className="flex items-center gap-2"><input type="checkbox" checked={p.enabled}
            onChange={async (e) => done((await supabase.from("providers").update({ enabled: e.target.checked }).eq("slug", p.slug)).error)} />{p.name} <code className="text-xs">{p.slug}</code></label>))}
      </section>

      <section className="panel space-y-3"><h2 className="font-bold">Directories (shown in the dropdown)</h2>
        {directories.map((d) => (
          <div key={d.id} className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.active}
              onChange={async (e) => done((await supabase.from("directories").update({ active: e.target.checked }).eq("id", d.id)).error)} />{d.name}</label>
            <span style={{ color: "var(--muted)" }}>via {d.provider_slug}</span>
            <button className="btn !py-1 ml-auto" onClick={async () => confirm(`Delete ${d.name}?`) && done((await supabase.from("directories").delete().eq("id", d.id)).error)}>Delete</button>
          </div>))}
        <div className="flex flex-wrap gap-2">
          <input className="field !w-auto" placeholder="Directory name" value={dirName} onChange={(e) => setDirName(e.target.value)} />
          <select className="field !w-auto" value={dirProv} onChange={(e) => setDirProv(e.target.value)}>{providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
          <button className="btn btn-primary" disabled={!dirName.trim()} onClick={async () => done((await supabase.from("directories").insert({ name: dirName.trim(), provider_slug: dirProv })).error)}>Add</button>
        </div>
      </section>

      <section className="panel space-y-3"><h2 className="font-bold">Countries and cities</h2>
        <div className="flex flex-wrap gap-2">
          <input className="field !w-24" placeholder="Code (bd)" maxLength={2} value={cc} onChange={(e) => setCc(e.target.value.toLowerCase())} />
          <input className="field !w-auto" placeholder="Country name" value={cn} onChange={(e) => setCn(e.target.value)} />
          <button className="btn btn-primary" disabled={cc.length !== 2 || !cn.trim()} onClick={async () => done((await supabase.from("countries").insert({ code: cc, name: cn.trim() })).error)}>Add country</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field !w-auto" value={cityCountry} onChange={(e) => setCityCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          <input className="field !w-auto" placeholder="City name" value={cityName} onChange={(e) => setCityName(e.target.value)} />
          <button className="btn btn-primary" disabled={!cityName.trim()} onClick={async () => done((await supabase.from("cities").insert({ country_code: cityCountry, name: cityName.trim() })).error)}>Add city</button>
        </div>
        <div className="space-y-2 text-sm">
          {countries.map((c) => (
            <div key={c.code}><strong>{c.name}</strong>:{" "}
              {cities.filter((x) => x.country_code === c.code).map((x) => (
                <button key={x.id} className="btn !py-0.5 !px-2 mr-1 mb-1" title="Click to delete" onClick={async () => confirm(`Delete ${x.name}?`) && done((await supabase.from("cities").delete().eq("id", x.id)).error)}>{x.name} ✕</button>))}
            </div>))}
        </div>
      </section>
    </div>
  );
}
