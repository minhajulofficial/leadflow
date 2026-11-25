/**
 * Open/click tracking. Each sent email carries a signed token that binds one
 * campaign recipient (no raw ids or emails in URLs). The pixel and the
 * rewritten links both point at public GET routes that verify the token
 * before recording anything.
 *
 * Tokens carry the `track:` purpose prefix, so they can never be replayed
 * as unsubscribe tokens (see lib/email/signing.ts).
 */
import { b64url, signToken, unb64url, verifyToken } from "./signing";

export type TrackingToken = { recipientId: string; userId: string };

export async function signTracking(recipientId: string, userId: string, keyB64?: string): Promise<string> {
  return signToken(`track:${recipientId}:${userId}`, keyB64);
}

export async function verifyTracking(token: string, keyB64?: string): Promise<TrackingToken | null> {
  const payload = await verifyToken(token, keyB64);
  if (!payload || !payload.startsWith("track:")) return null;
  const rest = payload.slice("track:".length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const recipientId = rest.slice(0, colon), userId = rest.slice(colon + 1);
  if (!recipientId || !userId) return null;
  return { recipientId, userId };
}

export const pixelUrl = (origin: string, token: string) =>
  `${origin}/api/email/track/open?token=${encodeURIComponent(token)}`;

export const clickUrl = (origin: string, token: string, target: string) =>
  `${origin}/api/email/track/click?token=${encodeURIComponent(token)}&u=${b64url(new TextEncoder().encode(target))}`;

export function decodeClickTarget(u: string): string | null {
  try {
    const target = new TextDecoder().decode(unb64url(u));
    if (target.length > 2048) return null;
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return target;
  } catch {
    return null;
  }
}

const HREF_RE = /<a\s+[^>]*href="([^"]+)"[^>]*>/gi;

/**
 * Turn bare http(s) URLs in an already-escaped HTML body into links, then
 * rewrite every link (except the unsubscribe footer) to the click tracker,
 * and append the 1px open pixel. The unsubscribe link is recognised by its
 * path and left alone — it has its own signed token.
 */
export async function addTracking(
  html: string, recipientId: string, userId: string, origin: string, keyB64?: string,
): Promise<string> {
  let token: string;
  try {
    token = await signTracking(recipientId, userId, keyB64);
  } catch {
    // Tracking is best-effort: a missing or broken key must never block a
    // send. The email goes out untracked (plain links, no pixel).
    return html;
  }
  // 1. linkify bare URLs (the body arrives HTML-escaped, so real links are
  //    plain text; skip anything already inside a tag).
  const linkified = html.replace(/(https?:\/\/[^\s<>"')]+)/g, (url) => {
    const clean = url.replace(/[.,;:!?]+$/, "");
    const tail = url.slice(clean.length);
    return `<a href="${clean}">${clean}</a>${tail}`;
  });
  // 2. rewrite links to the tracker.
  const tracked = linkified.replace(HREF_RE, (whole, href: string) => {
    if (href.includes("/api/email/unsubscribe")) return whole;
    if (!/^https?:\/\//i.test(href)) return whole;
    // the body arrives HTML-escaped: decode &amp; so the redirect target
    // carries a real & in its query string.
    return whole.replace(href, clickUrl(origin, token, href.replace(/&amp;/g, "&")));
  });
  // 3. open pixel.
  return `${tracked}<img src="${pixelUrl(origin, token)}" width="1" height="1" alt="" style="display:none" />`;
}

/** 1x1 transparent GIF, returned by the open route. */
export const PIXEL_BYTES = Uint8Array.from(atob(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
), (c) => c.charCodeAt(0));
