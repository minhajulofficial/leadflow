# LeadFlow – Setup

## Prerequisites

- Node.js + npm (the repo pins npm via `packageManager` in `package.json`).
- A Supabase project and a Cloudflare account (for deploy).
- An Apify account (only needed for auto lead collection, Phase 4).

## 1. Database — run the migrations in order

In Supabase > SQL Editor, run every file in `supabase/migrations/`,
in filename order. Do not skip any — later steps assume all six are applied.

| File | What it does |
| --- | --- |
| `0001_init.sql` | Profiles, plans (Free / Pro seeds), roles, auto-profile trigger |
| `0002_leads.sql` | Leads table, duplicate indexes, monthly-limit trigger |
| `0003_payments_admin.sql` | Payments, payment methods, admin review / set-plan RPCs, audit log |
| `0004_collect.sql` | Providers, directories, countries / cities, lead runs, provider-key RPCs |
| `0005_backfill_profiles.sql` | Creates profile rows for users who signed up before setup (safe to re-run) |
| `0006_grants.sql` | Explicit table grants for newer Supabase projects (see Fixes below) |

## 2. Auth providers

Supabase > Authentication > Providers: enable **Email**. Google sign-in is
optional — to use it, enable the Google provider there and add its OAuth
client ID / secret (Google Cloud Console), then test "Continue with Google".

## 3. Redirect URLs

Supabase > Authentication > URL Configuration, add:
`http://localhost:5173/auth/callback` and
`https://YOUR-CLOUDFLARE-URL/auth/callback`.
(5173 is Vite's default dev port — no port is configured in
`vite.config.ts`, so if your dev server reports a different port, use that
one instead. The old SETUP.md said port 3000; nothing in the repo sets
port 3000.)

## 4. Environment variables

```sh
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Project Settings > API). Then make the encryption key — it protects users'
Apify keys. In a browser press F12 > Console, paste this and copy the result:

```js
btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
```

Put it in `.env.local` as `ENCRYPTION_KEY` for local dev. **In production it
must be a Cloudflare Secret**, not a plain variable: Cloudflare > Workers &
Pages > leadflow > Settings > Variables and Secrets > Add, Type = **Secret**,
name = `ENCRYPTION_KEY`. Save it somewhere safe too: if you lose it, every
user must re-enter their API keys.

Never put the Supabase service_role key in the frontend or share it in chat.
It is not used by this app.

## 5. Run locally

```sh
npm install
npm run dev
```

## 6. Make yourself admin

Sign up, then in SQL Editor:

```sql
update public.profiles set role='admin' where email='YOUR@EMAIL';
```

## 7. Deploy

Push to GitHub — Cloudflare builds and deploys on every push. (Or run
`npm run deploy`.) In Cloudflare, add the two `NEXT_PUBLIC_` variables as
variables and `ENCRYPTION_KEY` as a **Secret** (see step 4).

## Payments + admin (Phase 3)

- Admin pages need 2-step verification: open `/admin` (it redirects to
  `/two-step`), scan the QR with an authenticator app, enter the code.
- Admin > Payment methods: set your real bKash / Nagad number and tick
  **Active**. The seeded methods are inactive with a placeholder number
  until you do this.
- Lost authenticator? Supabase dashboard > Authentication > Users > your
  user > remove the MFA factor, then enrol again.
- Payments are approved / rejected in Admin > Payments; approval activates
  or extends Pro by 30 days and is written to the audit log.

## Auto lead collection (Phase 4)

1. `ENCRYPTION_KEY` must be set (step 4) — without it, provider keys cannot
   be saved.
2. Admin > Collect settings: switch providers on, manage directories,
   countries and cities.
3. Each user: Integrations > paste their own Apify API token (it is tested
   against Apify before saving), then Collect leads.

## Tests

```sh
npm test            # 4 unit suites + 3 database suites (PGlite, no Supabase needed)
npm run test:db-new # same database suites with NO_DEFAULT_GRANTS=1
```

## Fixes

### "Profile not found" / permission errors even though the profile exists

Run `supabase/migrations/0006_grants.sql`. Newer Supabase projects do not
auto-grant table access to the website role, so the app needs these explicit
grants. (Older notes called this file `leadflow-fix-permissions.sql` — that
filename does not exist; `0006_grants.sql` is the real file.)

### "No profile for this account" / admin page not opening

1. Run `supabase/migrations/0005_backfill_profiles.sql` — it creates the
   missing profile rows. (Older notes called this `leadflow-fix-admin.sql` —
   that filename does not exist; `0005_backfill_profiles.sql` is the real
   file. Note it only creates profiles; it does **not** make anyone admin.)
2. Then set your role, as in step 6:
   `update public.profiles set role='admin' where email='YOUR@EMAIL';`
3. Open `/admin` and scan the MFA QR.

## Email sending (Phase 5)

1. In Supabase > SQL Editor, run `supabase/migrations/0007_email.sql`
   (after 0001–0006). It adds sender accounts, templates, campaigns,
   recipients, the send queue and the suppression list, all with
   Row Level Security (a user sees only their own rows).
2. Set two more Cloudflare Secrets (Workers & Pages > leadflow >
   Settings > Variables and Secrets):
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase > Project Settings > API.
     Used ONLY server-side by the queue worker (cron mode) and the
     unsubscribe route. It never reaches the browser.
   - `CRON_SECRET` — any long random string. The queue endpoint
     (`POST /api/email/queue/process`) only accepts requests carrying
     `Authorization: Bearer <CRON_SECRET>`.
3. Background sending: add a trigger that POSTs to
   `https://YOUR-CLOUDFLARE-URL/api/email/queue/process` with that
   header every 5 minutes — Cloudflare Cron Triggers, an external cron
   service, or Supabase pg_cron. Without a trigger, sending still works:
   the "Process my queue now" button on a sending campaign processes
   your own queued mail immediately.
4. Each user connects Resend in Email > Senders (API key from
   resend.com/api-keys; the key is verified against Resend, then stored
   encrypted). The sender address must use a domain verified in Resend —
   for a first test, `onboarding@resend.dev` works.
5. Daily limits come from the plan (Free 20 / Pro 500 emails per day)
   and are enforced by the queue worker, not just the UI.
