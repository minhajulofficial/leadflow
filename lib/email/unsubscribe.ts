/**
 * Signed one-click unsubscribe links. The token binds a (user, email) pair
 * with an HMAC-SHA256 keyed by ENCRYPTION_KEY, so a link cannot be forged
 * or reused for another address. No login is needed to unsubscribe.
 * Tokens carry the `unsub:` purpose prefix, so they can never be replayed
 * as tracking tokens (see lib/email/signing.ts).
 */
import { signToken, verifyToken } from "./signing";

export async function signUnsubscribe(userId: string, email: string, keyB64?: string): Promise<string> {
  return signToken(`unsub:${userId}:${email.trim().toLowerCase()}`, keyB64);
}

export async function verifyUnsubscribe(
  token: string, keyB64?: string,
): Promise<{ userId: string; email: string } | null> {
  const payload = await verifyToken(token, keyB64);
  if (!payload || !payload.startsWith("unsub:")) return null;
  const rest = payload.slice("unsub:".length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const userId = rest.slice(0, colon), email = rest.slice(colon + 1);
  if (!userId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { userId, email };
}
