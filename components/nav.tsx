"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

export function SideNav({ groups }: { groups: { label?: string; items: NavItem[] }[] }) {
  const path = usePathname();
  const on = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <div className="nav-label">{g.label}</div>}
          <ul className="space-y-1">
            {g.items.map((i) => (
              <li key={i.href}><Link href={i.href} className="nav-link" aria-current={on(i) ? "page" : undefined}><Icon n={i.icon} fw />{i.label}</Link></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const on = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  return (
    <nav aria-label="Main" className="flex items-stretch gap-1 px-2 pt-1.5">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="tab-link" aria-current={on(i) ? "page" : undefined}><Icon n={i.icon} />{i.label}</Link>
      ))}
    </nav>
  );
}
