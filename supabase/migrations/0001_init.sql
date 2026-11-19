-- LeadFlow Phase 1: profiles, plans, audit log, RLS
create table public.plans (
  id text primary key,
  name text not null,
  price_bdt integer not null default 0,
  limits jsonb not null default '{}'::jsonb
);
insert into public.plans (id, name, price_bdt, limits) values
  ('free', 'Free', 0,   '{"leads_per_month":100,"emails_per_day":20,"extension":false}'),
  ('pro',  'Pro',  999, '{"leads_per_month":5000,"emails_per_day":500,"extension":true}');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' references public.plans(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- auto-create profile on signup (email or Google)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy "plans readable" on public.plans for select to authenticated using (true);
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admin reads profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin reads audit" on public.audit_logs for select to authenticated using (public.is_admin());

-- users may edit only harmless columns; role and plan can never be self-changed
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
