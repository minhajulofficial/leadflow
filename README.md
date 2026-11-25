# LeadFlow

Find business leads from online directories, filter out the weak ones, and
reach the good ones by email — all from one dashboard.

- **Collect leads automatically** through the user's own Apify account
  (Google Maps), or add them manually / by CSV import.
- **Quality filters first**: phone, website, email, rating and review count
  are checked before a lead counts against the plan.
- **Plans**: Free (BDT 0) and Pro (BDT 999 per 30 days), paid manually
  through bKash / Nagad and approved by an admin.
- **Admin panel** with payment review, plan control and 2-step verification.

Live app: https://leadflow.minhajulofficial-bd.workers.dev

## Status

Phases 1–4 are built: auth + roles, leads + CSV, billing + admin (MFA),
auto collection via Apify. Phases 5–8 are planned: email sending
(Resend first), tracking + AI writer, Chrome extension, launch readiness.
See `SETUP.md` for setup and the product requirements document (v1.0,
21 Nov 2026) held by the owner for the full spec.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend + server | Next.js app via `vinext`, running on Cloudflare Workers |
| Database, auth | Supabase (Postgres, Auth, Row Level Security, RPC functions) |
| Collection provider | Apify (Google Maps actor), user's own account + key |
| Styling / icons | Tailwind CSS, Font Awesome (bundled), Plus Jakarta Sans (self-hosted) |
| Secrets | `ENCRYPTION_KEY` as a Cloudflare secret (AES-256-GCM for provider keys) |

## Quick start

```sh
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
```

1. Create a Supabase project. In SQL Editor, run the migrations in order:
   `supabase/migrations/0001_init.sql` … `0006_grants.sql` (see `SETUP.md`).
2. Supabase > Authentication > Providers: enable Email (Google is optional).
   Add redirect URLs `http://localhost:5173/auth/callback` and
   `https://YOUR-CLOUDFLARE-URL/auth/callback`. (5173 is Vite's default
   dev port — no port is configured in `vite.config.ts`, so if your dev
   server reports a different port, use that one.)
3. Generate an `ENCRYPTION_KEY` (see `.env.example`) and put it in
   `.env.local` for local dev.
4. `npm run dev`, sign up, then make yourself admin in SQL Editor:
   `update public.profiles set role='admin' where email='YOUR@EMAIL';`
5. Deploy: push to GitHub (Cloudflare builds on every push) or
   `npm run deploy`. In Cloudflare, set the two `NEXT_PUBLIC_` variables
   as variables and `ENCRYPTION_KEY` as a **Secret**.

Full step-by-step setup, admin/MFA notes and fixes: see `SETUP.md`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (`vite dev`) |
| `npm run build` | Build the Cloudflare Worker output (`vite build`) |
| `npm run start` | Preview the built Worker locally |
| `npm run deploy` | Deploy the Worker (`vinext-cloudflare deploy`) |
| `npm test` | All tests: 4 unit suites (`tsx`) + 3 database suites (`node`, PGlite) |
| `npm run test:db-new` | Same database suites with `NO_DEFAULT_GRANTS=1` (newer Supabase behaviour) |

Database tests run migrations against a real Postgres engine
(`@electric-sql/pglite`) — no Supabase project needed.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Marketing page, login, dashboard (leads, collect, integrations, billing, setup status), admin, API routes (`api/collect/*`, `api/providers/key`) |
| `lib/` | Plans/limits, lead cleaning + CSV, billing, collection + Apify client, AES-256-GCM crypto, admin helpers |
| `components/` | App shell, nav, icons, logo, page head |
| `supabase/migrations/` | `0001` foundation + plans, `0002` leads, `0003` payments + admin, `0004` collection, `0005` profile backfill, `0006` explicit grants |
| `tests/` | Unit assert-scripts (`leads`, `billing`, `collect`, `apify`) + DB suites (`db-security`, `db-collect`, `db-backfill`) |

## Plans and limits

| | Free | Pro |
| --- | --- | --- |
| Price | BDT 0 | BDT 999 per 30 days |
| Leads per month | 100 | 5,000 |
| Results per collection run | 20 | 500 |
| Emails per day (planned) | 20 | 500 |
| Chrome extension (planned) | No | Yes |

Limits live in the database (`plans` table + `effective_plan()`), enforced
by a trigger so they cannot be bypassed from the browser. The marketing
constants in `lib/site.ts` must be kept in sync with the database seeds.

## Security notes

- Row Level Security on every table; access decisions live in the database.
- Third-party keys are encrypted with AES-256-GCM and never shown in the
  browser; the database function that releases a key works only for its
  owner and only when both the admin and the user switches are on.
- The Supabase **service_role key is never used by the app** — do not put
  it in the frontend or share it in chat.
- Admin access requires the admin role **and** 2-step verification (TOTP)
  in the current session; the database enforces this, not just the UI.
