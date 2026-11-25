-- LeadFlow Phase 5: email sending (Resend first) — senders, templates, campaigns, recipients, queue, suppression
--
-- Design notes (see REPORT-PHASE5.md):
-- * Sender credentials are stored ENCRYPTED by the app (AES-256-GCM, lib/crypto.ts),
--   exactly like Apify keys. The browser can never read the api_key_enc column back.
-- * RLS: a user sees only their own rows. Admins see NONE of a user's senders or
--   campaigns (same privacy rule as leads) — there is deliberately no admin policy.
-- * The queue is processed without a browser session by the cron route
--   (app/api/email/queue/process), which uses a server-only service-role client.
--   The service-role key is a Cloudflare Secret, never in the browser or logs.
--   It is NOT referenced in this migration: on Supabase-hosted Postgres the
--   service role already bypasses RLS. (PGlite test runs simulate it as superuser.)

-- sender_accounts: each user's own sending accounts
create table public.sender_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default 'resend' check (provider in ('resend', 'smtp')),
  name text not null,
  from_email text not null,
  from_name text,
  api_key_enc text,
  daily_limit integer check (daily_limit is null or (daily_limit >= 1 and daily_limit <= 10000)),
  active boolean not null default true,
  last_used_at timestamptz,
  has_key boolean generated always as (api_key_enc is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- templates: reusable subject + body
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- campaigns: one outreach run (subject/body with {{merge}} fields)
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_id uuid references public.sender_accounts(id) on delete set null,
  name text not null default '',
  subject text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'paused', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_user_idx on public.campaigns (user_id, created_at desc);

-- campaign_recipients: one row per lead in a campaign. user_id is denormalised
-- so RLS and the daily-usage count stay simple (no join through campaigns).
create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  email text not null,
  email_key text generated always as (lower(email)) stored,
  name text,
  company text,
  city text,
  country text,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sending', 'sent', 'failed', 'skipped', 'suppressed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id),
  unique (campaign_id, email_key)
);
create index campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id, status);
create index campaign_recipients_sent_idx on public.campaign_recipients (user_id, sent_at);

-- email_queue: internal send queue. Never touched by the browser directly;
-- rows are written by enqueue_campaign() and claimed by the queue worker.
create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.campaign_recipients(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references public.sender_accounts(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_try timestamptz not null default now(),
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_id)
);
create index email_queue_due_idx on public.email_queue (status, next_try, created_at);

-- suppression_list: unsubscribed / bounced / complaining addresses. Never sent to.
create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text not null,
  email_key text generated always as (lower(email)) stored,
  reason text not null default 'unsubscribed'
    check (reason in ('unsubscribed', 'bounced', 'complaint')),
  created_at timestamptz not null default now(),
  unique (user_id, email_key)
);

-- RLS: own rows only, on every table. No admin policy on purpose.
alter table public.sender_accounts enable row level security;
alter table public.templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_queue enable row level security;
alter table public.suppression_list enable row level security;

create policy "own senders read" on public.sender_accounts for select to authenticated using (user_id = auth.uid());
create policy "own templates read" on public.templates for select to authenticated using (user_id = auth.uid());
create policy "own templates write" on public.templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own campaigns read" on public.campaigns for select to authenticated using (user_id = auth.uid());
create policy "own campaigns insert" on public.campaigns for insert to authenticated with check (user_id = auth.uid());
create policy "own campaigns update" on public.campaigns for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own campaigns delete" on public.campaigns for delete to authenticated using (user_id = auth.uid());
create policy "own recipients read" on public.campaign_recipients for select to authenticated using (user_id = auth.uid());
create policy "own recipients insert" on public.campaign_recipients for insert to authenticated with check (user_id = auth.uid());
create policy "own recipients update" on public.campaign_recipients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own suppression read" on public.suppression_list for select to authenticated using (user_id = auth.uid());
create policy "own suppression insert" on public.suppression_list for insert to authenticated with check (user_id = auth.uid());
create policy "own suppression delete" on public.suppression_list for delete to authenticated using (user_id = auth.uid());
-- email_queue: the browser never inserts or deletes rows (only the
-- enqueue_campaign() RPC writes them), but the server routes read and update
-- the caller's OWN rows while processing their queue. A user can only ever
-- touch their own rows; claiming another user's jobs is impossible.
create policy "own queue read" on public.email_queue for select to authenticated using (user_id = auth.uid());
create policy "own queue update" on public.email_queue for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- explicit grants (0006-style: newer projects get no default grants)
grant select, insert, update, delete on public.templates, public.campaigns,
  public.campaign_recipients, public.suppression_list to authenticated;
grant select, update on public.email_queue to authenticated; -- own rows only, via RLS (no insert/delete)
-- sender credentials: the browser may see everything EXCEPT the encrypted key,
-- and may never write the table directly — all writes go through the RPCs below.
revoke all on public.sender_accounts from anon, authenticated;
grant select (id, user_id, provider, name, from_email, from_name, daily_limit,
  active, last_used_at, has_key, created_at, updated_at) on public.sender_accounts to authenticated;

-- save (or replace) a sender account. The app verifies the key against Resend
-- BEFORE calling this; the key arrives already encrypted.
create or replace function public.save_sender_account(
  p_provider text, p_name text, p_enc text, p_from_email text,
  p_from_name text default null, p_daily_limit int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_provider not in ('resend', 'smtp') then raise exception 'UNKNOWN_PROVIDER'; end if;
  if p_from_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'BAD_FROM_EMAIL'; end if;
  if p_daily_limit is not null and (p_daily_limit < 1 or p_daily_limit > 10000) then raise exception 'BAD_DAILY_LIMIT'; end if;
  insert into public.sender_accounts (user_id, provider, name, api_key_enc, from_email, from_name, daily_limit, active)
  values (auth.uid(), p_provider, p_name, p_enc, lower(trim(p_from_email)), nullif(trim(coalesce(p_from_name, '')), ''), p_daily_limit, true)
  on conflict (user_id, name) do update set
    provider = excluded.provider, api_key_enc = excluded.api_key_enc,
    from_email = excluded.from_email, from_name = excluded.from_name,
    daily_limit = excluded.daily_limit, active = true, updated_at = now()
  returning id into sid;
  return sid;
end $$;

create or replace function public.set_sender_enabled(p_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.sender_accounts set active = p_enabled, updated_at = now()
   where id = p_id and user_id = auth.uid()
     and (not p_enabled or api_key_enc is not null);
  if not found then raise exception 'NO_KEY'; end if;
end $$;

create or replace function public.update_sender_account(
  p_id uuid, p_from_name text, p_from_email text, p_daily_limit int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_from_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'BAD_FROM_EMAIL'; end if;
  if p_daily_limit is not null and (p_daily_limit < 1 or p_daily_limit > 10000) then raise exception 'BAD_DAILY_LIMIT'; end if;
  update public.sender_accounts
     set from_name = nullif(trim(coalesce(p_from_name, '')), ''),
         from_email = lower(trim(p_from_email)), daily_limit = p_daily_limit, updated_at = now()
   where id = p_id and user_id = auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create or replace function public.delete_sender_account(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.sender_accounts where id = p_id and user_id = auth.uid();
$$;

-- returns the encrypted key only to its owner (no admin switch for senders)
create or replace function public.get_sender_key(p_id uuid) returns text
language sql security definer stable set search_path = public as $$
  select api_key_enc from public.sender_accounts
   where id = p_id and user_id = auth.uid() and active;
$$;

-- emails sent today vs the plan's daily limit (Free 20 / Pro 500)
create or replace function public.my_email_usage() returns table(sent_today int, lim int)
language sql security definer stable set search_path = public as $$
  select (select count(*)::int from public.campaign_recipients
           where user_id = auth.uid() and status = 'sent' and sent_at >= date_trunc('day', now())),
         (select (p.limits->>'emails_per_day')::int from public.plans p
           where p.id = public.effective_plan(auth.uid()));
$$;

-- Move a sending campaign's pending recipients into the queue, exactly once.
-- Suppressed addresses are marked 'suppressed' and never enqueued.
create or replace function public.enqueue_campaign(p_campaign uuid)
returns table(queued int, skipped_suppressed int)
language plpgsql security definer set search_path = public as $$
declare q int := 0; s int := 0;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.campaigns
                  where id = p_campaign and user_id = auth.uid() and status = 'sending') then
    raise exception 'NOT_SENDING';
  end if;
  with sup as (
    update public.campaign_recipients r set status = 'suppressed'
     where r.campaign_id = p_campaign and r.status = 'pending'
       and exists (select 1 from public.suppression_list s
                    where s.user_id = auth.uid() and s.email_key = r.email_key)
    returning r.id
  ) select count(*)::int into s from sup;
  with ins as (
    insert into public.email_queue (recipient_id, campaign_id, user_id, sender_id)
    select r.id, r.campaign_id, r.user_id, c.sender_id
      from public.campaign_recipients r join public.campaigns c on c.id = r.campaign_id
     where r.campaign_id = p_campaign and r.status = 'pending'
    on conflict (recipient_id) do nothing
    returning recipient_id
  ) select count(*)::int into q from ins;
  update public.campaign_recipients set status = 'queued'
   where campaign_id = p_campaign and status = 'pending'
     and id in (select recipient_id from public.email_queue where campaign_id = p_campaign);
  return query select q, s;
end $$;

-- Atomically claim up to p_limit of the caller's own due jobs for sending.
-- Only jobs of campaigns still in 'sending' are claimed (paused ones wait).
create or replace function public.claim_my_email_jobs(p_limit int)
returns table(job_id uuid, recipient_id uuid, campaign_id uuid, sender_id uuid)
language sql security definer set search_path = public as $$
  with due as (
    select id from public.email_queue
     where user_id = auth.uid() and status = 'queued' and next_try <= now()
       and campaign_id in (select id from public.campaigns where status = 'sending')
     order by created_at limit greatest(p_limit, 1)
     for update skip locked
  )
  update public.email_queue q set status = 'sending', claimed_at = now(), updated_at = now()
   from due where q.id = due.id
  returning q.id, q.recipient_id, q.campaign_id, q.sender_id;
$$;

revoke execute on function
  public.save_sender_account(text, text, text, text, text, int),
  public.set_sender_enabled(uuid, boolean),
  public.update_sender_account(uuid, text, text, int),
  public.delete_sender_account(uuid),
  public.get_sender_key(uuid),
  public.my_email_usage(),
  public.enqueue_campaign(uuid),
  public.claim_my_email_jobs(int)
from public, anon;
grant execute on function
  public.save_sender_account(text, text, text, text, text, int),
  public.set_sender_enabled(uuid, boolean),
  public.update_sender_account(uuid, text, text, int),
  public.delete_sender_account(uuid),
  public.get_sender_key(uuid),
  public.my_email_usage(),
  public.enqueue_campaign(uuid),
  public.claim_my_email_jobs(int)
to authenticated;

notify pgrst, 'reload schema';
