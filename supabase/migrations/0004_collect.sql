-- LeadFlow Phase 4: auto lead collection (providers, directories, locations, runs, encrypted user API keys)

update public.plans set limits = limits || '{"max_per_run":20}'  where id = 'free';
update public.plans set limits = limits || '{"max_per_run":500}' where id = 'pro';

create or replace function public.my_plan_limits() returns jsonb
language sql security definer stable set search_path = public as $$
  select p.limits from public.plans p where p.id = public.effective_plan(auth.uid());
$$;

-- providers: managed by admin (on/off switch)
create table public.providers (
  slug text primary key,
  name text not null,
  description text,
  actor text not null,
  enabled boolean not null default true
);
insert into public.providers (slug, name, description, actor) values
  ('apify-google-maps', 'Apify - Google Maps', 'Business listings from Google Maps via your own Apify account.', 'compass~crawler-google-places');

create table public.directories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider_slug text not null references public.providers(slug) on delete cascade,
  active boolean not null default true
);
insert into public.directories (name, provider_slug) values ('Google Maps', 'apify-google-maps');

create table public.countries (code text primary key, name text not null unique);
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  name text not null,
  unique (country_code, name)
);
insert into public.countries (code, name) values
  ('bd','Bangladesh'),('us','United States'),('gb','United Kingdom'),('in','India'),
  ('ae','United Arab Emirates'),('ca','Canada'),('au','Australia'),('sa','Saudi Arabia');
insert into public.cities (country_code, name) values
  ('bd','Dhaka'),('bd','Chattogram'),('bd','Sylhet'),('bd','Rajshahi'),('bd','Khulna'),('bd','Gazipur'),
  ('us','New York'),('us','Los Angeles'),('us','Chicago'),('us','Houston'),('us','Miami'),('us','San Francisco'),
  ('gb','London'),('gb','Manchester'),('gb','Birmingham'),
  ('in','Mumbai'),('in','Delhi'),('in','Bengaluru'),('in','Kolkata'),
  ('ae','Dubai'),('ae','Abu Dhabi'),('ca','Toronto'),('ca','Vancouver'),
  ('au','Sydney'),('au','Melbourne'),('sa','Riyadh'),('sa','Jeddah');

alter table public.providers enable row level security;
alter table public.directories enable row level security;
alter table public.countries enable row level security;
alter table public.cities enable row level security;
create policy "providers read"  on public.providers   for select to authenticated using (enabled or public.is_admin());
create policy "providers admin" on public.providers   for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "dirs read"       on public.directories for select to authenticated using (active or public.is_admin());
create policy "dirs admin"      on public.directories for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "countries read"  on public.countries   for select to authenticated using (true);
create policy "countries admin" on public.countries   for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cities read"     on public.cities      for select to authenticated using (true);
create policy "cities admin"    on public.cities      for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- each user's own provider key (stored ENCRYPTED by the app; the browser can never read it back)
create table public.user_provider_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_slug text not null references public.providers(slug) on delete cascade,
  enabled boolean not null default false,
  api_key_enc text,
  has_key boolean generated always as (api_key_enc is not null) stored,
  updated_at timestamptz not null default now(),
  unique (user_id, provider_slug)
);
alter table public.user_provider_settings enable row level security;
create policy "own settings read" on public.user_provider_settings for select to authenticated using (user_id = auth.uid());
revoke all on public.user_provider_settings from anon, authenticated;
grant select (id, user_id, provider_slug, enabled, has_key, updated_at) on public.user_provider_settings to authenticated;

create or replace function public.save_provider_key(p_slug text, p_enc text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.providers where slug = p_slug) then raise exception 'UNKNOWN_PROVIDER'; end if;
  insert into public.user_provider_settings (user_id, provider_slug, api_key_enc, enabled)
  values (auth.uid(), p_slug, p_enc, true)
  on conflict (user_id, provider_slug) do update set api_key_enc = excluded.api_key_enc, updated_at = now();
end $$;

create or replace function public.set_provider_enabled(p_slug text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.user_provider_settings set enabled = p_enabled, updated_at = now()
   where user_id = auth.uid() and provider_slug = p_slug and (not p_enabled or api_key_enc is not null);
  if not found then raise exception 'NO_KEY'; end if;
end $$;

create or replace function public.delete_provider_key(p_slug text) returns void
language sql security definer set search_path = public as $$
  delete from public.user_provider_settings where user_id = auth.uid() and provider_slug = p_slug;
$$;

-- returns the encrypted key only if the admin AND the user both have the provider switched on
create or replace function public.get_provider_key(p_slug text) returns text
language sql security definer stable set search_path = public as $$
  select s.api_key_enc from public.user_provider_settings s join public.providers p on p.slug = s.provider_slug
   where s.user_id = auth.uid() and s.provider_slug = p_slug and s.enabled and p.enabled;
$$;

revoke execute on function public.save_provider_key(text, text), public.set_provider_enabled(text, boolean),
  public.delete_provider_key(text), public.get_provider_key(text), public.my_plan_limits() from public, anon;
grant execute on function public.save_provider_key(text, text), public.set_provider_enabled(text, boolean),
  public.delete_provider_key(text), public.get_provider_key(text), public.my_plan_limits() to authenticated;

-- one row per collection run
create table public.lead_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_slug text not null references public.providers(slug),
  label text,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'running' check (status in ('running','importing','succeeded','failed')),
  external_run_id text,
  dataset_id text,
  found integer not null default 0,
  added integer not null default 0,
  skipped integer not null default 0,
  duplicates integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index lead_runs_user_idx on public.lead_runs (user_id, created_at desc);
alter table public.lead_runs enable row level security;
create policy "own runs read"   on public.lead_runs for select to authenticated using (user_id = auth.uid());
create policy "own runs insert" on public.lead_runs for insert to authenticated with check (user_id = auth.uid() and status = 'running');
create policy "own runs update" on public.lead_runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
