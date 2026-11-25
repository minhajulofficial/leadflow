/**
 * Svix webhook signatures (Resend signs its webhooks with Svix).
 * Headers: svix-id, svix-timestamp, svix-signature (`v1,<base64>`).
 * Signature: HMAC-SHA256 over `svix-id.svix-timestamp.rawBody`, keyed by the
 * webhook secret (base64, with an optional `whsec_` prefix). The timestamp
 * must be within 5 minutes of now, so a captured payload cannot be replayed
 * later. Returns false on any problem — callers fail closed.
 */
const te = new TextEncoder();

function secretBytes(secret: string): Uint8Array<ArrayBuffer> | null {
  try {
    const clean = secret.replace(/^whsec_/, "");
    const bin = atob(clean);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.length ? u : null;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySvixSignature(
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
  secret?: string,
): Promise<boolean> {
  try {
    if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
    const ts = Number(headers.timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
    const keyBytes = secretBytes(secret);
    if (!keyBytes) return false;
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
    const sig = await crypto.subtle.sign("HMAC", key, te.encode(signed));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    // the header can carry several space-separated signatures; any v1 match wins
    return headers.signature.split(" ").some((part) => {
      const [version, value] = part.split(",");
      return version === "v1" && !!value && timingSafeEqual(value, expected);
    });
  } catch {
    return false;
  }
}

/**
 * Pull message ids out of In-Reply-To / References headers. Resend sent
 * emails carry a Message-ID built from the Resend message id, so a reply
 * that quotes it can be matched back to the exact sent email. Returns the
 * ids found, in order of appearance.
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function extractReplyTargetIds(headers: unknown): string[] {
  const texts: string[] = [];
  const collect = (v: unknown) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(collect);
  };
  collect(headers);
  const out: string[] = [];
  for (const t of texts) {
    for (const m of t.matchAll(UUID_RE)) {
      const id = m[0].toLowerCase();
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}
