// AES-256-GCM encryption for users' provider API keys. Works in Cloudflare Workers and Node 20+.
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

async function importKey(keyB64?: string) {
  if (!keyB64) throw new Error("ENCRYPTION_KEY_MISSING");
  let raw: ReturnType<typeof unb64>;
  try { raw = unb64(keyB64.trim()); } catch { throw new Error("ENCRYPTION_KEY_INVALID"); }
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY_INVALID");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, keyB64?: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(token: string, keyB64?: string): Promise<string> {
  const key = await importKey(keyB64);
  const [v, iv, ct] = token.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("BAD_CIPHERTEXT");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return td.decode(pt);
}
