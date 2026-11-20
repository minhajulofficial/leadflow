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

## Fix: "profile not found" even though the profile exists
Run `leadflow-fix-permissions.sql` (0006). Newer Supabase projects do not auto-grant table access to the website.

## Fix: admin page not opening
Run `leadflow-fix-admin.sql` (creates missing profiles + makes you admin). Then open /admin and scan the MFA QR.

## Phase 4 (auto lead collection)
1. Supabase SQL Editor: run `supabase/migrations/0004_collect.sql`.
2. Make an encryption key (it protects users' API keys). In your browser press F12 > Console, paste this and copy the result:
   `btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))`
3. Cloudflare > Workers & Pages > leadflow > Settings > Variables and Secrets > Add. Type = **Secret**, name = `ENCRYPTION_KEY`, value = the text from step 2. Save it somewhere safe too: if you lose it, users must re-enter their API keys.
4. Admin > Collect settings: switch providers on, manage directories, countries and cities.
5. Each user: Integrations > paste their own Apify API token, then Collect leads.
- Run all tests: `npm test`
