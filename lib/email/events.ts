/**
 * email_events — the append-only per-recipient timeline. One row per thing
 * that happened to one sent email. Repeat opens/clicks are recorded (the
 * dedupe index only collapses webhook replays, which carry an external_id).
 */
export const EVENT_TYPES = [
  "sent", "delivered", "opened", "clicked", "bounced", "replied", "complained", "unsubscribed",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EmailEventInput = {
  recipientId: string;
  campaignId: string;
  userId: string;
  type: EventType;
  externalId?: string | null;
  targetUrl?: string | null;
  meta?: Record<string, unknown>;
};

/** Insert one event. `db` is any Supabase client (service-role on public
 *  routes, the caller's session client on signed-in routes). Webhook replays
 *  with the same external_id are ignored, never duplicated. */
export async function recordEvent(db: any, e: EmailEventInput): Promise<void> {
  await db.from("email_events").upsert(
    {
      recipient_id: e.recipientId,
      campaign_id: e.campaignId,
      user_id: e.userId,
      type: e.type,
      external_id: e.externalId ?? null,
      target_url: e.targetUrl ?? null,
      meta: e.meta ?? {},
    },
    { onConflict: "recipient_id,type,external_id", ignoreDuplicates: true },
  );
}

/** First-seen timestamps kept on the recipient row for quick display. */
export const EVENT_TO_COLUMN: Partial<Record<EventType, string>> = {
  opened: "opened_at",
  clicked: "clicked_at",
  bounced: "bounced_at",
  replied: "replied_at",
};
