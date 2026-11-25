/**
 * Shared HMAC-SHA256 signing for public email links (unsubscribe, tracking
 * pixel, click redirect). A token is `b64url(payload).b64url(signature)` where
 * the signature is keyed by ENCRYPTION_KEY (a base64 32-byte key). Callers
 * put a purpose prefix in the payload (e.g. `unsub:` / `track:`) so a token
 * minted for one purpose can never be replayed for another.
 */
const te = new TextEncoder();

export const b64url = (u: Uint8Array) =>
  btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

async function hmacKey(keyB64?: string): Promise<CryptoKey> {
  if (!keyB64) throw new Error("ENCRYPTION_KEY_MISSING");
  // ENCRYPTION_KEY is a base64-encoded 32-byte key (see .env.example).
  const bin = atob(keyB64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) throw new Error("ENCRYPTION_KEY_INVALID");
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Sign a payload string. Returns the full `payloadSig.payload` token. */
export async function signToken(payload: string, keyB64?: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(keyB64), te.encode(payload)));
  return `${b64url(te.encode(payload))}.${b64url(sig)}`;
}

/** Verify a token. Returns the payload string, or null when it does not check out. */
export async function verifyToken(token: string, keyB64?: string): Promise<string | null> {
  try {
    const dot = token.indexOf(".");
    if (dot < 0) return null;
    const p = token.slice(0, dot), s = token.slice(dot + 1);
    if (!p || !s) return null;
    const payload = new TextDecoder().decode(unb64url(p));
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(keyB64), unb64url(s), te.encode(payload));
    return ok ? payload : null;
  } catch {
    return null;
  }
}
