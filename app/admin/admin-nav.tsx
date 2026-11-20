import Link from "next/link";

export default function AdminNav() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xl font-bold">Admin</span>
      <nav className="flex flex-wrap gap-2">
        <Link href="/admin" className="btn">Overview</Link>
        <Link href="/admin/payments" className="btn">Payments</Link>
        <Link href="/admin/methods" className="btn">Payment methods</Link>
        <Link href="/admin/collect" className="btn">Collect settings</Link>
        <Link href="/dashboard" className="btn">Back to app</Link>
      </nav>
    </header>
  );
}
