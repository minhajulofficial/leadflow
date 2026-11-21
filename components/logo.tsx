import { useId } from "react";

/** Brand mark. Each instance gets its own gradient id (duplicate ids break when one copy is display:none). */
export default function Logo({ size = 34, text = true, onDark = false }: { size?: number; text?: boolean; onDark?: boolean }) {
  const id = "lf" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64"><stop offset="0" stopColor="#5b5bf0" /><stop offset="1" stopColor="#8b3fe8" /></linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={onDark ? "#ffffff" : `url(#${id})`} />
        <g fill="none" stroke={onDark ? `url(#${id})` : "#ffffff"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 15v30h22" /><path d="M36 35l9 10-9 10" /></g>
      </svg>
      {text && <span className="text-xl font-extrabold tracking-tight">LeadFlow</span>}
    </span>
  );
}
