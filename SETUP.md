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

## Phase 3 (payments + admin)
- Run `supabase/migrations/0003_payments_admin.sql` after 0001 and 0002.
- Admin pages need 2-step verification: open `/admin`, scan the QR with an authenticator app, enter the code.
- Admin > Payment methods: set your real bKash/Nagad number and tick Active.
- Lost authenticator? Supabase dashboard > Authentication > Users > your user > remove the MFA factor, then enrol again.
- Database security tests (real Postgres engine, no Supabase needed): `npm i -D @electric-sql/pglite && node tests/db-security.test.mjs`
