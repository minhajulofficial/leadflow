import Link from "next/link";
import Logo from "./logo";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

/** Shared shell for the public legal pages: header, content, footer links. */
export default function LegalPage({
  title,
  draft,
  children,
}: {
  title: string;
  draft?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="LeadFlow home"><Logo /></Link>
        <Link href="/login" className="btn">Sign in</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="muted mt-2 text-sm">Last updated: {LEGAL.lastUpdated}. Operated by {LEGAL.companyName}.</p>
        {draft && (
          <div className="alert alert-warn mt-5" role="status">
            <strong>DRAFT — not final.</strong> {draft}
          </div>
        )}
        <article className="panel mt-6 space-y-5 text-[.95rem] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </article>
        <footer className="mt-10 border-t pt-6 text-sm" style={{ borderColor: "var(--line)" }}>
          <p className="muted mb-3">Questions? Contact {LEGAL.supportEmail}.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="underline underline-offset-2">{p.label}</Link>
            ))}
          </nav>
        </footer>
      </main>
    </div>
  );
}
