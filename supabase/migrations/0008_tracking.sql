-- LeadFlow Phase 6: tracking & intelligence — events, AI keys, recipient timeline
--
-- Design notes:
-- * email_events is the per-recipient timeline (sent / delivered / opened /
--   clicked / bounced / replied / complained / unsubscribed). Opens and clicks
--   are recorded by public signed links (HMAC, see lib/email/tracking.ts);
--   bounces/complaints/deliveries arrive via the Resend webhook
--   (Svix-signed, see lib/email/webhook.ts). RLS: a user sees only their own
--   rows. Admins see NONE of a user's events (same privacy rule as leads).
-- * Writes from public routes (tracking pixel, click redirect, webhooks) use
--   the server-only service-role client, exactly like the unsubscribe route
--   in Phase 5: those visitors have no login session, so RLS cannot admit
--   them. The signed token / Svix signature IS the authorization; the
--   service client is only the mechanism. The key never reaches the browser.
-- * ai_keys stores the user's own AI-provider keys (Gemini / OpenAI) encrypted
--   with AES-256-GCM, exactly like sender keys. The browser can never read
--   api_key_enc; all writes go through the RPCs below.
-- * campaign_recipients gains resend_id (to match webhooks + replies to the
--   exact sent email) and first-seen timestamps for the timeline.
-- * campaigns.tracking_enabled lets a campaign opt out of open/click tracking.

-- email_events: one row per thing that happened to one sent email.
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.campaign_recipients(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'replied', 'complained', 'unsubscribed')),
  external_id text,
  target_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index email_events_recipient_idx on public.email_events (recipient_id, created_at desc);
create index email_events_campaign_idx on public.email_events (campaign_id, type, created_at desc);
-- Webhook replays dedupe: the same (recipient, type, external event id) is
-- stored once. NULL external_id rows (pixel/click opens) stay distinct in
-- Postgres, so repeat opens/clicks are still recorded.
create unique index email_events_dedupe_uidx on public.email_events (recipient_id, type, external_id);

-- ai_keys: the user's own AI-provider keys for the AI writer.
create table public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai')),
  api_key_enc text,
  active boolean not null default true,
  has_key boolean generated always as (api_key_enc is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- recipient timeline columns + Resend id for webhook/reply matching.
alter table public.campaign_recipients
  add column if not exists resend_id text,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists replied_at timestamptz;
alter table public.campaigns
  add column if not exists tracking_enabled boolean not null default true;

-- RLS: own rows only. No admin policy on purpose.
alter table public.email_events enable row level security;
alter table public.ai_keys enable row level security;

create policy "own events read" on public.email_events for select to authenticated using (user_id = auth.uid());
create policy "own events insert" on public.email_events for insert to authenticated with check (user_id = auth.uid());
-- no update/delete policies: events are an append-only timeline.
-- ai_keys: the browser may list its own keys (never the ciphertext column —
-- that is withheld by the column grant below); all writes go through RPCs.
create policy "own ai keys read" on public.ai_keys for select to authenticated using (user_id = auth.uid());

-- explicit grants (0006-style: newer projects get no default grants)
grant select, insert on public.email_events to authenticated;
-- ai_keys: the browser may see everything EXCEPT the encrypted key,
-- and may never write the table directly — all writes go through the RPCs below.
revoke all on public.ai_keys from anon, authenticated;
grant select (id, user_id, provider, active, has_key, created_at, updated_at) on public.ai_keys to authenticated;

-- save (or replace) an AI key. The app verifies the key against the provider
-- BEFORE calling this; the key arrives already encrypted.
create or replace function public.save_ai_key(
  p_provider text, p_enc text) returns uuid
language plpgsql security definer set search_path = public as $$
declare kid uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_provider not in ('gemini', 'openai') then raise exception 'UNKNOWN_PROVIDER'; end if;
  insert into public.ai_keys (user_id, provider, api_key_enc, active)
  values (auth.uid(), p_provider, p_enc, true)
  on conflict (user_id, provider) do update set
    api_key_enc = excluded.api_key_enc, active = true, updated_at = now()
  returning id into kid;
  return kid;
end $$;

create or replace function public.set_ai_key_enabled(p_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ai_keys set active = p_enabled, updated_at = now()
   where id = p_id and user_id = auth.uid()
     and (not p_enabled or api_key_enc is not null);
  if not found then raise exception 'NO_KEY'; end if;
end $$;

create or replace function public.delete_ai_key(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.ai_keys where id = p_id and user_id = auth.uid();
$$;

-- returns the encrypted key only to its owner (no admin switch for AI keys)
create or replace function public.get_ai_key(p_provider text) returns text
language sql security definer stable set search_path = public as $$
  select api_key_enc from public.ai_keys
   where user_id = auth.uid() and provider = p_provider and active
   order by updated_at desc limit 1;
$$;

revoke execute on function
  public.save_ai_key(text, text),
  public.set_ai_key_enabled(uuid, boolean),
  public.delete_ai_key(uuid),
  public.get_ai_key(text)
from public, anon;
grant execute on function
  public.save_ai_key(text, text),
  public.set_ai_key_enabled(uuid, boolean),
  public.delete_ai_key(uuid),
  public.get_ai_key(text)
to authenticated;

-- --- DB backstop for validation (Phase 6.4) ---------------------------------
-- A malformed address can never be stored as a recipient, so it can never
-- be enqueued. The app still checks syntax + MX before sending; this is
-- only the last line of defence.
alter table public.campaign_recipients
  add constraint campaign_recipients_email_valid
  check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

notify pgrst, 'reload schema';
