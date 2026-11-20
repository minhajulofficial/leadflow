/** A paid plan counts as Free once its expiry date has passed. */
export function effectivePlan(plan: string | null | undefined, expires: string | null | undefined, now = Date.now()) {
  const p = plan ?? "free";
  return p !== "free" && expires && new Date(expires).getTime() < now ? "free" : p;
}
