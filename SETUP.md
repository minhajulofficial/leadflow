# LeadFlow – Setup

## Prerequisites

- Node.js + npm (the repo pins npm via `packageManager` in `package.json`).
- A Supabase project and a Cloudflare account (for deploy).
- An Apify account (only needed for auto lead collection, Phase 4).

## 1. Database — run the migrations in order

In Supabase > SQL Editor, run every file in `supabase/migrations/`,
in filename order. Do not skip any — later steps assume all eight are applied.

| File | What it does |
| --- | --- |
| `0001_init.sql` | Profiles, plans (Free / Pro seeds), roles, auto-profile trigger |
| `0002_leads.sql` | Leads table, duplicate indexes, monthly-limit trigger |
| `0003_payments_admin.sql` | Payments, payment methods, admin review / set-plan RPCs, audit log |
| `0004_collect.sql` | Providers, directories, countries / cities, lead runs, provider-key RPCs |
| `0005_backfill_profiles.sql` | Creates profile rows for users who signed up before setup (safe to re-run) |
| `0006_grants.sql` | Explicit table grants for newer Supabase projects (see Fixes below) |
| `0007_email.sql` | Email sending: senders, templates, campaigns, recipients, queue, suppression (Phase 5) |
| `0008_tracking.sql` | Email tracking: events timeline, AI-provider keys, recipient timestamps (Phase 6) |

## 2. Auth providers

Supabase > Authentication > Providers: enable **Email**. Google sign-in is
optional — to use it, enable the Google provider there and add its OAuth
client ID / secret (Google Cloud Console), then test "Continue with Google".

### Google sign-in checklist (Phase 8, FR-1.1)

1. Google Cloud Console (console.cloud.google.com) → create a project (or
   reuse one) → APIs & Services → Credentials → Create Credentials →
   **OAuth client ID**, application type **Web application**.
2. In that client, under **Authorized redirect URIs**, add the URI Supabase
   shows you (Supabase → Authentication → Providers → Google → the
   "Callback URL", of the form
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
3. Supabase → Authentication → Providers → **Google** → Enable, paste the
   Client ID and Client Secret from step 1, Save.
4. Supabase → Authentication → URL Configuration → Redirect URLs → add
   `https://YOUR-CLOUDFLARE-URL/auth/callback` (and
   `http://localhost:5173/auth/callback` for local dev — see step 3).
5. Test: sign out, open `/login`, click **Continue with Google** — you
   should land on `/dashboard` signed in. If Google shows
   `redirect_uri_mismatch`, the URI in step 2 is wrong; if Supabase shows
   "provider is not enabled", step 3 did not save.
6. Note: the first Google sign-in creates a profile row automatically
   (migration 0001 trigger). A Google user is a normal user until an admin
   sets their role — Google sign-in never grants admin by itself.

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

## Tracking & intelligence (Phase 6)

1. In Supabase > SQL Editor, run `supabase/migrations/0008_tracking.sql`
   (after 0007). It adds the email event timeline, AI-provider keys, and
   per-recipient open/click/bounce/reply timestamps.
2. Set one more Cloudflare Secret: `RESEND_WEBHOOK_SECRET` — from Resend >
   Settings > Webhooks, the signing secret for the webhook endpoints. Add
   two endpoints in Resend, both with that secret:
   - `https://YOUR-CLOUDFLARE-URL/api/email/webhooks/resend` — subscribe to
     email.delivered, email.bounced, email.complained, email.opened,
     email.clicked. Bounces and complaints suppress the address.
   - `https://YOUR-CLOUDFLARE-URL/api/email/webhooks/resend-inbound` —
     subscribe to email.received. This needs Resend Inbound enabled for the
     sending domain (MX records point at Resend) — until then, replies are
     recorded with the manual "Mark replied" button on a campaign.
3. AI writer: each user connects their own Gemini (free tier) or OpenAI key
   in Email > AI writer. The key is verified, then stored encrypted.
4. Deliverability: Email > Deliverability checks SPF, DKIM and DMARC for a
   domain over DNS. Analytics (Email > Analytics) shows open, click, reply
   and bounce rates per campaign, sender and niche.

## Launch readiness (Phase 8)

### Backups & restore

- **Supabase tiers:** the Free tier has no automatic backups and pauses
  after inactivity. The **Pro tier ($25/month)** includes daily backups
  (7-day retention); Point-in-Time Recovery (PITR, 7 days) is an add-on.
  Upgrade before the first paying customer (PRD Q9, NFR-P4).
- **Manual backup (works on any tier):** run the export script from your
  own machine with the service-role key — never in the browser, never
  commit its output (it contains user data):
  ```sh
  SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY \
  node scripts/export-backup.mjs
  ```
  It writes one JSON file per table (see `lib/backup.ts` `BACKUP_TABLES`)
  into `backups/<timestamp>/` plus a manifest with row counts.
- **Restore:** re-insert each table's rows in `BACKUP_TABLES` order
  (parents first, so foreign keys hold), then verify: run
  `node tests/db-backup.test.mjs` — it proves an export round-trips with
  identical row counts on a fixture. For a real restore, repeat the same
  check against a scratch Supabase project before touching production.
  Restoring never overwrites the `plans` seed rows unless you choose to.

### Monitoring

- **Errors (Sentry, SDK-free):** set `SENTRY_DSN` as a Cloudflare Secret
  (Sentry → Settings → Projects → your project → Client Keys (DSN)).
  The app reports server errors via `lib/monitoring.ts` (Sentry envelope
  over fetch — no SDK, Workers-safe) and browser errors via
  `/api/monitoring/error`. With no DSN set, reporting is off and the
  endpoint is a no-op. No DSN or error content ever goes in the repo.
- **Uptime:** point any uptime monitor (e.g. UptimeRobot, Better Stack,
  Cloudflare's own checks) at `https://YOUR-CLOUDFLARE-URL/api/health`.
  Alert when the response is not 200, or when the body says
  `"db": "error"`, for 2 consecutive checks. The endpoint returns
  `{ ok, version, time, db }` and never leaks error text.

### Security

- **Rate limits** (`lib/rate-limit.ts`, per IP per minute, in-memory and
  per Worker isolate — see the file for the caveat): tracking pixel/click
  120, unsubscribe 10, Resend webhooks 300, queue/process 12, email
  validation 30, browser error reports 10, account export 10, account
  deletion 3. Tracking endpoints fail OPEN on limit (pixel/redirect still
  served, event not recorded); everything else answers 429.
- **Security headers** are set in `next.config.ts` (HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP — the
  CSP keeps `unsafe-inline` for scripts/styles because Next.js streaming
  needs it; see the comment there). Verify live after deploy:
  `curl -I https://YOUR-CLOUDFLARE-URL/` should list them.
- **Sign-up / sign-in abuse:** login, signup, and password reset run
  client-side against Supabase Auth, so there is no app route to rate-limit
  — Supabase Auth enforces its own sign-in rate limits (the login page
  already shows a friendly "too many attempts" message). For bot
  protection, enable **Cloudflare Turnstile** on the login page or WAF
  rules in the Cloudflare dashboard; that is an owner step, not code.
- **Legal pages:** `/privacy`, `/terms`, `/acceptable-use`, `/refund`,
  `/dpa` — linked from the landing footer and the dashboard footer. The
  company name, address, and support email are placeholders in
  `lib/legal.ts` until the owner fills them in; `/refund` is a DRAFT until
  the owner approves the policy (Q6).

### Account export & deletion

- Users export all their data from **Settings → Account → Download my
  data (JSON)**. Encrypted provider keys are never included.
- Deletion is in the same place: type `DELETE` to confirm. It deletes the
  profile, leads, runs, provider keys, senders, templates, campaigns,
  recipients, queue rows, email events, suppression entries, and AI keys.
  **Kept on purpose:** payment records (refund-window proof) and the audit
  log. The login is anonymised and permanently banned rather than removed
  from Auth — deleting the auth user would cascade-delete the retained
  payments. An admin who is the only admin cannot delete themselves; make
  another admin first (see `lib/account.ts`).
