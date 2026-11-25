/**
 * Email validation: syntax + domain MX check over DNS-over-HTTPS (Workers
 * have no raw DNS). Syntax failures are always invalid. MX "unknown" (the
 * DNS lookup itself failed) is NOT a failure — it must never block a send
 * just because a lookup timed out; only a definite "no MX records" blocks.
 *
 * Deep third-party verification (PRD Q7, optional/paid) plugs in later via
 * the EmailVerifier interface — nothing here picks a paid provider.
 */
import { isEmail } from "../leads";

export type MxResult = "ok" | "none" | "unknown";
export type EmailValidation = {
  email: string;
  syntax: boolean;
  mx: MxResult;
  valid: boolean;
  reason?: string;
};

const DOH_TIMEOUT_MS = 5000;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function dohMx(domain: string, fetchFn: FetchFn): Promise<MxResult> {
  // Cloudflare DoH (JSON), Google DoH as fallback. Both answer
  // { Status, Answer: [{ type: 15, data: "10 mail.example.com." }] }.
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchFn(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const j: any = await res.json().catch(() => null);
      if (!j || typeof j.Status !== "number") continue;
      if (j.Status === 3) return "none"; // NXDOMAIN
      const answers: any[] = Array.isArray(j.Answer) ? j.Answer : [];
      if (answers.some((a) => a?.type === 15)) return "ok";
      if (j.Status === 0) return "none"; // NOERROR, no MX records
      return "unknown";
    } catch {
      continue; // try the next resolver
    }
  }
  return "unknown";
}

export function validateEmailSyntax(email: string): boolean {
  const e = email.trim();
  if (e.length > 254 || e.length < 3) return false;
  const at = e.lastIndexOf("@");
  if (at < 1 || at > 64) return false; // local part 1–64 chars
  if (e.includes("..")) return false;
  return isEmail(e);
}

export async function validateEmail(email: string, fetchFn: FetchFn = fetch): Promise<EmailValidation> {
  const e = email.trim().toLowerCase();
  if (!validateEmailSyntax(e)) {
    return { email: e, syntax: false, mx: "unknown", valid: false, reason: "Not a valid email address." };
  }
  const domain = e.slice(e.lastIndexOf("@") + 1);
  const mx = await dohMx(domain, fetchFn);
  if (mx === "none") {
    return { email: e, syntax: true, mx, valid: false, reason: `The domain ${domain} has no mail server (no MX records).` };
  }
  return { email: e, syntax: true, mx, valid: true, reason: mx === "unknown" ? "Mail server could not be checked." : undefined };
}

/** MX status per unique domain (one DoH lookup per domain, cached in the call). */
export async function validateEmailDomains(
  emails: string[], fetchFn: FetchFn = fetch,
): Promise<Map<string, MxResult>> {
  const domains = [...new Set(emails.map((e) => e.trim().toLowerCase().split("@").pop() ?? "").filter(Boolean))];
  const out = new Map<string, MxResult>();
  await Promise.all(domains.map(async (d) => out.set(d, await dohMx(d, fetchFn))));
  return out;
}

/** Plug-in point for a paid deep-verification provider (PRD Q7). */
export interface EmailVerifier {
  name: string;
  verify(email: string): Promise<{ valid: boolean; reason?: string }>;
}

/** The built-in verifier: syntax + MX only, no third party, no cost. */
export const syntaxAndMxVerifier: EmailVerifier = {
  name: "syntax+mx",
  async verify(email: string) {
    const v = await validateEmail(email);
    return { valid: v.valid, reason: v.reason };
  },
};
