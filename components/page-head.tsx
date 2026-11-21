import { Icon, type IconName } from "./icon";

export default function PageHead({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rise">
      <div className="flex items-start gap-3.5">
        <span className="icon-chip"><Icon n={icon} /></span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="muted mt-0.5 max-w-2xl text-[.95rem]">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
