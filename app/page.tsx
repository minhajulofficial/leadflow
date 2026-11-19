import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">LeadFlow</span>
        <Link href="/login" className="btn">Sign in</Link>
      </header>
      <section className="py-24 max-w-2xl">
        <h1 className="text-5xl font-bold leading-tight">
          Find the right clients, then reach out before anyone else does.
        </h1>
        <p className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
          Collect leads from business directories, filter out the weak ones, and send
          tracked email campaigns, all in one place.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/login?mode=signup" className="btn btn-primary">Start free</Link>
          <Link href="/login" className="btn">I have an account</Link>
        </div>
      </section>
    </main>
  );
}
