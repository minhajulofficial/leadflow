-- Newer Supabase projects do NOT automatically let the API role (authenticated) touch tables created with SQL.
-- Grant it explicitly. Row Level Security still decides WHICH rows each user can see.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- keep the stricter column-level rules from earlier migrations
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
revoke all on public.user_provider_settings from authenticated;
grant select (id, user_id, provider_slug, enabled, has_key, updated_at) on public.user_provider_settings to authenticated;

-- functions used by security policies and by the app
grant execute on function
  public.is_admin(), public.my_lead_usage(), public.my_plan_limits(),
  public.admin_review_payment(uuid, boolean, text), public.admin_set_plan(uuid, text, int),
  public.save_provider_key(text, text), public.set_provider_enabled(text, boolean),
  public.delete_provider_key(text), public.get_provider_key(text)
to authenticated;

notify pgrst, 'reload schema';
