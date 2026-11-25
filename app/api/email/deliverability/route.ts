import { createClient } from "@/lib/supabase/server";
import { json } from "@/lib/http";

/**
 * Deliverability checker: SPF / DKIM / DMARC records for a domain, looked
 * up over DNS-over-HTTPS (Workers have no raw DNS). Signed in only. The
 * DKIM selector defaults to `resend` (Resend's DKIM selector); pass
 * ?selector= to check another provider.
 */
type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function txtRecords(domain: string, fetchFn: FetchFn): Promise<string[]> {
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchFn(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const j: any = await res.json().catch(() => null);
      if (!j || typeof j.Status !== "number") continue;
      const answers: any[] = Array.isArray(j.Answer) ? j.Answer : [];
      const txts = answers.filter((a) => a?.type === 16).map((a) => String(a.data ?? "").replace(/^"|"$/g, ""));
      if (j.Status === 0) return txts;
      if (j.Status === 3) return [];
      return txts;
    } catch { continue; }
  }
  return [];
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase().replace(/^@/, "");
  const selector = (url.searchParams.get("selector") ?? "resend").trim().toLowerCase() || "resend";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return json({ error: "Enter a valid domain, e.g. acme.com." }, 400);

  const [spfTxt, dmarcTxt, dkimTxt] = await Promise.all([
    txtRecords(domain, fetch),
    txtRecords(`_dmarc.${domain}`, fetch),
    txtRecords(`${selector}._domainkey.${domain}`, fetch),
  ]);
  const spf = spfTxt.find((t) => t.startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((t) => t.startsWith("v=DMARC1"));
  const dkim = dkimTxt.find((t) => t.includes("v=DKIM1") || t.includes("p="));
  const hints: string[] = [];
  if (!spf) hints.push("No SPF record found — add a TXT record starting with v=spf1 that includes your sender (e.g. include:_spf.resend.com for Resend).");
  else if (!spf.includes("include:")) hints.push("SPF exists but names no sender — add include: for your sending service.");
  if (!spf?.includes("~all") && !spf?.includes("-all") && spf) hints.push("SPF should end with ~all or -all, or anyone can send as your domain.");
  if (!dmarc) hints.push("No DMARC record found — add _dmarc TXT starting with v=DMARC1; p=none to start, then p=quarantine.");
  else if (/p=none/.test(dmarc)) hints.push("DMARC is p=none (monitoring only). Move to p=quarantine once mail flows cleanly.");
  if (!dkim) hints.push(`No DKIM key found for selector "${selector}" — publish the key your sender gave you at ${selector}._domainkey.${domain}.`);
  if (spf && dmarc && dkim) hints.push("SPF, DKIM and DMARC are all present — the domain is set up for sending.");
  return json({
    domain, selector,
    spf: spf ? { found: true, record: spf } : { found: false, record: null },
    dmarc: dmarc ? { found: true, record: dmarc } : { found: false, record: null },
    dkim: dkim ? { found: true, record: dkim } : { found: false, record: null },
    hints,
  });
}
