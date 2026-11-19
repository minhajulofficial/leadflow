# LeadFlow – Phase 1 setup

1. Supabase: create a project, open SQL Editor, run `supabase/migrations/0001_init.sql`.
2. Supabase > Authentication > Providers: enable Email (and Google).
3. Supabase > Authentication > URL Configuration: add Redirect URLs
   `http://localhost:3000/auth/callback` and `https://YOUR-CLOUDFLARE-URL/auth/callback`.
4. Copy `.env.example` to `.env.local`, fill project URL and anon key (Project Settings > API).
5. `npm install` then `npm run dev`.
6. Sign up, then make yourself admin in SQL Editor:
   `update public.profiles set role='admin' where email='YOUR@EMAIL';`
7. Deploy: push to GitHub, then `npm run deploy`. Add the two NEXT_PUBLIC_ variables in Cloudflare too.

Never put the Supabase service_role key in the frontend or share it in chat.
