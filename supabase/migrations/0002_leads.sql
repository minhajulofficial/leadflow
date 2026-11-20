-- LeadFlow Phase 2: leads, duplicate protection, plan limit
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text, role text, company text,
  email text, phone text, website text, address text,
  city text, country text,
  facebook text, instagram text, linkedin text,
  niche text,
  rating numeric, reviews integer,
  source text not null default 'manual' check (source in ('manual','csv','auto','extension')),
  email_key text generated always as (lower(email)) stored,
  created_at timestamptz not null default now(),
  constraint lead_has_identity check (coalesce(name,email,phone,website) is not null)
);
create unique index leads_user_email_uq on public.leads (user_id, email_key);
create unique index leads_user_phone_uq on public.leads (user_id, phone);
create index leads_user_created_idx on public.leads (user_id, created_at desc);
create index leads_user_country_city_idx on public.leads (user_id, country, city);

alter table public.leads enable row level security;
create policy "own leads read"   on public.leads for select to authenticated using (user_id = auth.uid());
create policy "own leads insert" on public.leads for insert to authenticated with check (user_id = auth.uid());
create policy "own leads update" on public.leads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own leads delete" on public.leads for delete to authenticated using (user_id = auth.uid());

-- enforce the monthly plan limit on the server, so it cannot be bypassed from the browser
create or replace function public.enforce_lead_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; used int;
begin
  select (p.limits->>'leads_per_month')::int into lim
    from public.profiles pr join public.plans p on p.id = pr.plan where pr.id = new.user_id;
  select count(*) into used from public.leads
    where user_id = new.user_id and created_at >= date_trunc('month', now());
  if lim is not null and used >= lim then
    raise exception 'PLAN_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger leads_limit before insert on public.leads
  for each row execute function public.enforce_lead_limit();

-- usage numbers for the dashboard
create or replace function public.my_lead_usage() returns table(used int, lim int)
language sql security definer stable set search_path = public as $$
  select (select count(*)::int from public.leads where user_id = auth.uid() and created_at >= date_trunc('month', now())),
         (select (p.limits->>'leads_per_month')::int from public.profiles pr join public.plans p on p.id = pr.plan where pr.id = auth.uid());
$$;
