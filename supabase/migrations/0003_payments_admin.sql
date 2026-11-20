-- LeadFlow Phase 3: manual payments, plan expiry, admin RPCs, admin requires MFA (aal2)

alter table public.profiles add column plan_expires_at timestamptz;

-- plan shown/used = free once a paid plan has expired
create or replace function public.effective_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when plan <> 'free' and plan_expires_at is not null and plan_expires_at < now()
              then 'free' else plan end from public.profiles where id = uid;
$$;
revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;

-- admin = role admin AND logged in with 2-step verification (aal2). Protects every admin RLS policy.
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- use effective plan for lead limits
create or replace function public.enforce_lead_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; used int;
begin
  select (p.limits->>'leads_per_month')::int into lim
    from public.plans p where p.id = public.effective_plan(new.user_id);
  select count(*) into used from public.leads
    where user_id = new.user_id and created_at >= date_trunc('month', now());
  if lim is not null and used >= lim then
    raise exception 'PLAN_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.my_lead_usage() returns table(used int, lim int)
language sql security definer stable set search_path = public as $$
  select (select count(*)::int from public.leads where user_id = auth.uid() and created_at >= date_trunc('month', now())),
         (select (p.limits->>'leads_per_month')::int from public.plans p where p.id = public.effective_plan(auth.uid()));
$$;

-- payment methods the admin configures (bKash, Nagad, ...)
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_number text not null,
  instructions text,
  active boolean not null default false
);
insert into public.payment_methods (name, account_number, instructions) values
  ('bKash', 'SET-IN-ADMIN', 'Send Money to this number, then paste the TrxID below.'),
  ('Nagad', 'SET-IN-ADMIN', 'Send Money to this number, then paste the TrxID below.');
alter table public.payment_methods enable row level security;
create policy "methods read active" on public.payment_methods for select to authenticated using (active or public.is_admin());
create policy "methods admin write" on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan text not null references public.plans(id),
  amount integer not null default 0,
  method text not null,
  sender_number text not null,
  trx_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
-- the same TrxID can never be used twice (unless the earlier one was rejected)
create unique index payments_trx_uq on public.payments (method, trx_id) where status <> 'rejected';
create index payments_status_idx on public.payments (status, created_at desc);
alter table public.payments enable row level security;
create policy "own payments read" on public.payments for select to authenticated using (user_id = auth.uid());
create policy "admin payments read" on public.payments for select to authenticated using (public.is_admin());
create policy "own payment insert" on public.payments for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
-- no update/delete policies: only the admin RPC below can change a payment

create or replace function public.payments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare price int; pend int;
begin
  select price_bdt into price from public.plans where id = new.plan;
  if price is null or price <= 0 then raise exception 'NOT_A_PAID_PLAN'; end if;
  if not exists (select 1 from public.payment_methods where name = new.method and active) then
    raise exception 'METHOD_UNAVAILABLE';
  end if;
  select count(*) into pend from public.payments where user_id = new.user_id and status = 'pending';
  if pend >= 3 then raise exception 'TOO_MANY_PENDING'; end if;
  new.amount := price;                       -- never trust the amount from the browser
  new.status := 'pending';
  new.trx_id := upper(trim(new.trx_id));
  new.sender_number := trim(new.sender_number);
  if length(new.trx_id) < 6 or length(new.trx_id) > 40 then raise exception 'BAD_TRX'; end if;
  return new;
end $$;
create trigger payments_bi before insert on public.payments
  for each row execute function public.payments_before_insert();

create or replace function public.admin_review_payment(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into pay from public.payments where id = p_id for update;
  if not found or pay.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  update public.payments set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = p_note, reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
  if p_approve then
    update public.profiles set plan = pay.plan,
           plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '30 days'
     where id = pay.user_id;
  end if;
  insert into public.audit_logs (actor, action, detail) values (auth.uid(),
    case when p_approve then 'payment_approved' else 'payment_rejected' end,
    jsonb_build_object('payment_id', p_id, 'user', pay.user_id, 'trx', pay.trx_id));
end $$;

create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_days int default 30)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.plans where id = p_plan) then raise exception 'UNKNOWN_PLAN'; end if;
  update public.profiles set plan = p_plan,
         plan_expires_at = case when p_plan = 'free' then null else now() + make_interval(days => greatest(p_days, 1)) end
   where id = p_user;
  insert into public.audit_logs (actor, action, detail) values (auth.uid(), 'plan_set',
    jsonb_build_object('user', p_user, 'plan', p_plan, 'days', p_days));
end $$;

revoke execute on function public.admin_review_payment(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, int) from public, anon;
grant execute on function public.admin_review_payment(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, int) to authenticated;
