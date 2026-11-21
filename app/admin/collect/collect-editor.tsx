"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

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

  const Check = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />{label}</label>);
  return (
    <div className="space-y-4">
      {msg && <div role="alert" className="alert alert-bad"><Icon n="no" /><span>{msg}</span></div>}
      <section className="panel space-y-3"><h2 className="font-bold"><Icon n="plug" className="mr-2 muted" />Providers <span className="muted text-sm font-normal">(on/off for all users)</span></h2>
        {providers.map((p) => (<Check key={p.slug} on={p.enabled} label={<>{p.name} <code className="muted text-xs">{p.slug}</code></>}
          onChange={async (v) => done((await supabase.from("providers").update({ enabled: v }).eq("slug", p.slug)).error)} />))}
      </section>

      <section className="panel space-y-3"><h2 className="font-bold"><Icon n="layers" className="mr-2 muted" />Directories <span className="muted text-sm font-normal">(shown in the dropdown)</span></h2>
        {directories.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3">
            <Check on={d.active} label={d.name} onChange={async (v) => done((await supabase.from("directories").update({ active: v }).eq("id", d.id)).error)} />
            <span className="badge">{d.provider_slug}</span>
            <button className="btn btn-danger !py-1 ml-auto" onClick={async () => confirm(`Delete ${d.name}?`) && done((await supabase.from("directories").delete().eq("id", d.id)).error)}><Icon n="trash" /> Delete</button>
          </div>))}
        <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <input className="field !w-auto" aria-label="Directory name" placeholder="Directory name" value={dirName} onChange={(e) => setDirName(e.target.value)} />
          <select className="field !w-auto" aria-label="Provider" value={dirProv} onChange={(e) => setDirProv(e.target.value)}>{providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
          <button className="btn btn-primary" disabled={!dirName.trim()} onClick={async () => done((await supabase.from("directories").insert({ name: dirName.trim(), provider_slug: dirProv })).error)}><Icon n="plus" /> Add directory</button>
        </div>
      </section>

      <section className="panel space-y-4"><h2 className="font-bold"><Icon n="globe" className="mr-2 muted" />Countries and cities</h2>
        <div className="flex flex-wrap gap-2">
          <input className="field !w-28" aria-label="Country code" placeholder="Code (bd)" maxLength={2} value={cc} onChange={(e) => setCc(e.target.value.toLowerCase())} />
          <input className="field !w-auto" aria-label="Country name" placeholder="Country name" value={cn} onChange={(e) => setCn(e.target.value)} />
          <button className="btn btn-primary" disabled={cc.length !== 2 || !cn.trim()} onClick={async () => done((await supabase.from("countries").insert({ code: cc, name: cn.trim() })).error)}><Icon n="plus" /> Add country</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field !w-auto" aria-label="Country" value={cityCountry} onChange={(e) => setCityCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          <input className="field !w-auto" aria-label="City name" placeholder="City name" value={cityName} onChange={(e) => setCityName(e.target.value)} />
          <button className="btn btn-primary" disabled={!cityName.trim()} onClick={async () => done((await supabase.from("cities").insert({ country_code: cityCountry, name: cityName.trim() })).error)}><Icon n="plus" /> Add city</button>
        </div>
        <div className="space-y-3">
          {countries.map((c) => (
            <div key={c.code}><p className="mb-1.5 text-sm font-bold">{c.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {cities.filter((x) => x.country_code === c.code).map((x) => (
                  <button key={x.id} className="btn !py-1 !px-2.5 !text-xs" title="Click to delete" aria-label={`Delete ${x.name}`} onClick={async () => confirm(`Delete ${x.name}?`) && done((await supabase.from("cities").delete().eq("id", x.id)).error)}>{x.name} <Icon n="x" /></button>))}
              </div></div>))}
        </div>
      </section>
    </div>
  );
}
