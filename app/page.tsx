import Link from "next/link";
import Logo from "@/components/logo";
import { Icon, type IconName } from "@/components/icon";
import { FREE_LIMITS, PRO_LIMITS, PRO_PRICE_BDT } from "@/lib/site";

const FEATURES: { icon: IconName; title: string; text: string; soon?: boolean }[] = [
  { icon: "collect", title: "Auto lead collection", text: "Pick a niche, country and cities. We pull business listings through your own Apify account and save them as leads." },
  { icon: "filter", title: "Smart filters", text: "Keep only leads with a phone, website or email, a minimum rating, and the review range you want. No time wasted on weak leads." },
  { icon: "import", title: "Manual add & CSV import", text: "Add a lead by hand or drop in a CSV. Messy column names are matched automatically and duplicates are skipped." },
  { icon: "export", title: "One-click export", text: "Download your filtered leads as a clean CSV whenever you need them." },
  { icon: "chrome", title: "Chrome extension", text: "Capture leads while you browse any directory, straight into your account.", soon: true },
  { icon: "send", title: "Email outreach", text: "Connect Gmail or SMTP, send campaigns, and track opens, replies and bounces.", soon: true },
];
const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "plug", title: "Connect", text: "Paste your Apify API token once. It is encrypted and never shown again." },
  { icon: "search", title: "Collect", text: "Choose niches and cities, set your filters, press start." },
  { icon: "leads", title: "Reach out", text: "Review the leads that matched and export or contact them." },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="hero-glow" aria-hidden="true" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="LeadFlow home"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <a href="#pricing" className="btn hidden !border-transparent !bg-transparent sm:inline-flex">Pricing</a>
          <Link href="/login" className="btn">Sign in</Link>
          <Link href="/login?mode=signup" className="btn btn-primary">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 md:pt-24">
        <div className="max-w-3xl rise">
          <span className="badge mb-5"><Icon n="bolt" /> Lead hunting, without the busywork</span>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Find the right clients, <span className="gradient-text">then reach them first.</span>
          </h1>
          <p className="muted mt-6 max-w-2xl text-lg">
            Collect leads from business directories, filter out the weak ones, and keep everything in one tidy place.
            Free to start, no card needed.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="btn btn-primary btn-lg">Start free <Icon n="arrow" /></Link>
            <Link href="/login" className="btn btn-lg">I have an account</Link>
          </div>
        </div>

        <div className="panel mt-14 max-w-4xl !p-0 overflow-hidden rise" aria-hidden="true">
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
            <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="muted ml-3 text-xs">My leads</span>
          </div>
          <div className="table-wrap px-4 pb-3 pt-2">
            <table className="tbl"><thead><tr><th>Business</th><th>City</th><th>Phone</th><th>Rating</th><th>Source</th></tr></thead>
              <tbody>
                {[["Smile Dental Care", "Dhaka", "+880 17•• ••• 678", "4.8"], ["Brew & Bean Cafe", "Chattogram", "+880 18•• ••• 214", "4.6"], ["Pixel Studio", "Sylhet", "+880 19•• ••• 902", "4.9"]].map((r) => (
                  <tr key={r[0]}><td className="font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><Icon n="star" className="mr-1 text-amber-400" />{r[3]}</td><td><span className="badge">auto</span></td></tr>))}
              </tbody></table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-extrabold tracking-tight">Everything you need to fill your pipeline</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel">
              <div className="flex items-center justify-between"><span className="icon-chip"><Icon n={f.icon} /></span>{f.soon && <span className="badge badge-warn"><Icon n="hourglass" /> Coming soon</span>}</div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="muted mt-1.5 text-[.95rem]">{f.text}</p>
            </div>))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel flex gap-4"><span className="icon-chip"><Icon n={s.icon} /></span>
              <div><p className="muted text-xs font-bold uppercase tracking-wider">Step {i + 1}</p><h3 className="text-lg font-bold">{s.title}</h3><p className="muted mt-1 text-[.95rem]">{s.text}</p></div></li>))}
        </ol>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-extrabold tracking-tight">Simple pricing</h2>
        <p className="muted mt-2">Pay by bKash or Nagad. Upgrade or stop any time.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[{ n: "Free", p: "৳0", sub: "to get started", l: FREE_LIMITS, pro: false }, { n: "Pro", p: `৳${PRO_PRICE_BDT}`, sub: "per 30 days", l: PRO_LIMITS, pro: true }].map((t) => (
            <div key={t.n} className="panel" style={t.pro ? { borderColor: "var(--accent)" } : undefined}>
              <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{t.n}</h3>{t.pro && <span className="badge"><Icon n="crown" /> Most popular</span>}</div>
              <p className="mt-3"><span className="text-4xl font-extrabold">{t.p}</span> <span className="muted">{t.sub}</span></p>
              <ul className="mt-5 space-y-2.5 text-[.95rem]">
                {[`${t.l.leads.toLocaleString()} leads per month`, `Up to ${t.l.perRun} results per collection run`, "Smart filters, CSV import and export", t.pro ? "Chrome extension and email tools as they launch" : "Manual lead entry"].map((x) => (
                  <li key={x} className="flex gap-2.5"><Icon n="ok" className="mt-1 text-[var(--ok)]" />{x}</li>))}
              </ul>
              <Link href="/login?mode=signup" className={t.pro ? "btn btn-primary mt-6 w-full" : "btn mt-6 w-full"}>{t.pro ? "Get Pro" : "Start free"}</Link>
            </div>))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t px-5 py-8 text-sm" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><Logo size={26} /><p className="muted">© {new Date().getFullYear()} LeadFlow. Collect only public business data and follow each directory&apos;s terms.</p></div>
      </footer>
    </div>
  );
}
