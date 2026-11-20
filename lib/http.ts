export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** CSRF guard for cookie-authenticated POST routes: JSON content type + same-origin. */
export function sameOriginJson(req: Request): boolean {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}
