# LeadFlow — Launch checklist

Pre-launch gate (PRD Appendix C, expanded in Phase 8). Nothing here is
checked unless it is actually done — owner items stay unchecked until the
owner does them. Code-complete items are marked `[x] code` only where the
code exists; the matching live check is a separate unchecked line.

## Owner — fill in (Q6 / Q8)

- [ ] **Company details filled in** (`lib/legal.ts`): company name, address, support email. Until then every legal page shows `[COMPANY NAME]` / `[SUPPORT EMAIL]` placeholders.
- [ ] **Refund policy approved (Q6):** the `/refund` page is a DRAFT — approve the 7-day window and conditions, or change them, then remove the draft notice.
- [ ] **Support contact visible:** support email is the placeholder above until filled in; it appears in the legal pages and Settings.

## Owner — Supabase & secrets

- [ ] Migrations `0007_email.sql` and `0008_tracking.sql` run in Supabase (after 0001–0006).
- [ ] Cloudflare Secrets set: `ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`.
- [ ] **Supabase on a paid plan (Q9)** with scheduled backups enabled — required before the first paying customer (free tier pauses and has no automatic backups). Manual fallback: `node scripts/export-backup.mjs` (see SETUP.md).
- [ ] Backup restore test done on real data (export → restore to a scratch project → row counts match). The code-level round-trip test is `tests/db-backup.test.mjs`.
- [ ] **Google sign-in configured and tested (FR-1.1):** provider enabled in Supabase, OAuth client in Google Cloud Console, redirect URLs added, "Continue with Google" tested end to end. Checklist: SETUP.md §2.
- [ ] `ENCRYPTION_KEY` stored safely outside the repo; first real Apify run verified (1-city run, leads appear).

## Owner — payments & email

- [ ] Payment methods set with real bKash/Nagad numbers and Active ticked (Admin → Payment methods).
- [ ] Test payment approved end to end (submit TrxID → admin approves → Pro active 30 days).
- [ ] Owner's Resend API key connected (Email → Senders) + sender domain verified in Resend.
- [ ] Resend webhook endpoints added: `/api/email/webhooks/resend` (delivered/bounced/complained/opened/clicked) and `/api/email/webhooks/resend-inbound` (replies; needs Inbound + MX at Resend).
- [ ] Owner's Gemini (free) or OpenAI key connected for the AI writer (optional for launch).
- [ ] Queue trigger live: Cloudflare Cron Trigger (or equivalent) POSTs `/api/email/queue/process` every 5 minutes with `Bearer <CRON_SECRET>`.

## Owner — monitoring & admin

- [ ] **Sentry DSN set** as a Cloudflare Secret (`SENTRY_DSN`) — without it, error reporting is off and `/api/monitoring/error` is a no-op.
- [ ] **Uptime monitor configured:** watch `https://<domain>/api/health`, alert on non-200 (or `"db": "error"`) for 2 consecutive checks.
- [ ] Second admin account created, with 2-step verification (TOTP) done.
- [ ] Custom domain + branded sender for transactional email (Q8) — optional for first launch on the workers.dev domain.
- [ ] Bot protection decision: Cloudflare Turnstile on sign-up/sign-in, or WAF rules (Supabase Auth already rate-limits sign-in attempts; see SETUP.md "Security").

## Code — done in Phase 8 (verify live after deploy)

- [x] code — Legal pages: `/privacy`, `/terms`, `/acceptable-use`, `/refund` (DRAFT), `/dpa`, linked from the landing footer and the dashboard footer.
- [ ] live — Legal pages load signed-out; footer links work on landing + dashboard.
- [x] code — Rate limits on public routes (tracking, unsubscribe, webhooks, queue, validate, error reports, account export/delete); security headers in `next.config.ts`; `robots.txt` + `sitemap.xml` (public pages only).
- [ ] live — `curl -I` shows the security headers; rate-limit smoke test (11th unsubscribe hit in a minute → 429).
- [x] code — Account export (JSON download) + account deletion (type DELETE, last-admin guard, payments/audit retained) in Settings → Account.
- [ ] live — Deletion on a throwaway account: data gone, payments retained, login banned, original email can sign up fresh.
- [x] code — `/api/health` endpoint; Sentry error reporting (SDK-free, DSN-guarded); backup export script + restore test.
- [ ] live — `/api/health` returns 200 with `"db": "ok"`; backup script runs against the real project.

## Launch-day (agent, after the live checks above)

- [ ] First real Apify run + first real campaign + unsubscribe click verified live.
- [ ] "Coming soon" removed from landing/billing for email — ONLY after the Phase 5 live check passes.
- [ ] Extension still "Coming soon" (Phase 7, blocked on Q4 spec).
- [ ] Full test suite green on the pushed HEAD (`npm test`, `npx tsc --noEmit`, `npm run build`).

## After launch (not gates)

- [ ] Staging Supabase project + E2E browser tests for sign-up/import/payment/collection (PRD §14 "next").
- [ ] Manual regression checklist per release.
- [ ] Global rate limiting via Cloudflare KV/Durable Objects if per-isolate limits ever prove insufficient.
