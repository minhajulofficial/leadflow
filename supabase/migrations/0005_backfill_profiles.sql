-- Repair: users who signed up BEFORE the setup SQL ran have no profile row. Safe to run many times.
insert into public.profiles (id, email, full_name, avatar_url)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
       u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;
