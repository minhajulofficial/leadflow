/** Pure queue math: caps, sender rotation, retry backoff. No I/O, no secrets. */

export const MAX_ATTEMPTS = 3;          // tries per queued email, then it is marked failed
export const SEND_DELAY_MS = 1000;      // pause between sends in one worker pass (Resend-safe)
export const CRON_BATCH = 50;           // jobs per cron pass (all users)
export const USER_BATCH = 10;           // jobs per "send now" pass (one user)

export type SenderPick = {
  id: string; provider: string; active: boolean;
  daily_limit: number | null; last_used_at: string | null;
};

/** Minutes to wait before retrying attempt n (1-based): 5, 10, 20 … capped at 60. */
export function backoffMinutes(attempts: number): number {
  return Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Can this user send one more email today?
 * planLimit comes from plans.limits.emails_per_day (Free 20 / Pro 500).
 */
export function canSendToday(sentToday: number, planLimit: number | null): boolean {
  if (planLimit == null) return true;
  return sentToday < planLimit;
}

/** Remaining sends today under the plan limit (null = no plan cap known). */
export function remainingToday(sentToday: number, planLimit: number | null): number | null {
  return planLimit == null ? null : Math.max(0, planLimit - sentToday);
}

/**
 * Pick the next sender for one email (rotation across the user's senders).
 * Only active senders with daily quota left are eligible; the one used
 * longest ago wins (never-used senders first). Returns null when none can send.
 */
export function pickSender(
  senders: SenderPick[],
  sentTodayBySender: Record<string, number>,
  planLimit: number | null,
): SenderPick | null {
  const eligible = senders.filter((s) => {
    if (!s.active) return false;
    const cap = s.daily_limit ?? planLimit;
    if (cap == null) return true;
    return (sentTodayBySender[s.id] ?? 0) < cap;
  });
  if (!eligible.length) return null;
  eligible.sort((a, b) =>
    (a.last_used_at ?? "").localeCompare(b.last_used_at ?? ""));
  return eligible[0];
}
