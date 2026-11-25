/**
 * Signed one-click unsubscribe links. The token binds a (user, email) pair
 * with an HMAC-SHA256 keyed by ENCRYPTION_KEY, so a link cannot be forged
 * or reused for another address. No login is needed to unsubscribe.
 */
const te = new TextEncoder();
const b64url = (u: Uint8Array) =>
  btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => {
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

export async function signUnsubscribe(userId: string, email: string, keyB64?: string): Promise<string> {
  const payload = `${userId}.${email.trim().toLowerCase()}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(keyB64), te.encode(payload)));
  return `${b64url(te.encode(payload))}.${b64url(sig)}`;
}

export async function verifyUnsubscribe(
  token: string, keyB64?: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const [p, s] = token.split(".");
    if (!p || !s) return null;
    const payload = new TextDecoder().decode(unb64url(p));
    const dot = payload.indexOf(".");
    if (dot < 0) return null;
    const userId = payload.slice(0, dot), email = payload.slice(dot + 1);
    if (!userId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(keyB64), unb64url(s), te.encode(payload));
    return ok ? { userId, email } : null;
  } catch {
    return null;
  }
}
