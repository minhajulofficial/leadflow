// Legal-page details the owner has not supplied yet (PRD Q6/Q8).
// Every value here is a clearly-marked placeholder. Fill them in ONE place
// (this file) and every legal page, footer and support note updates.
// The launch checklist (LAUNCH_CHECKLIST.md) tracks filling these in.
export const LEGAL = {
  companyName: "[COMPANY NAME]",
  companyAddress: "[COMPANY ADDRESS]",
  supportEmail: "[SUPPORT EMAIL]",
  /** Live domain of the app. This one is real, not a placeholder. */
  domain: "leadflow.minhajulofficial-bd.workers.dev",
  lastUpdated: "25 November 2026",
} as const;

export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/dpa", label: "Data Processing Addendum" },
] as const;
