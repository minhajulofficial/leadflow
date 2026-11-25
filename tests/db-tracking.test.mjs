import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs"; import assert from "node:assert/strict";
const db = new PGlite();
const dir = "./supabase/migrations/";
await db.exec(`
 create role anon nologin; create role authenticated nologin; create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
 grant usage on schema auth, public to authenticated, anon;
 ${process.env.NO_DEFAULT_GRANTS ? "" : "alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;"}`);
for (const f of fs.readdirSync(dir).sort().filter((f) => !(process.env.SKIP_MIGRATION && f.startsWith(process.env.SKIP_MIGRATION)))) await db.exec(fs.readFileSync(dir + f, "utf8"));
const mk = async (e) => (await db.query(`insert into auth.users(email) values ('${e}') returning id`)).rows[0].id;
const A = await mk("a@x.com"), C = await mk("c@x.com"), ADM = await mk("admin@x.com");
await db.exec(`update public.profiles set role='admin' where email='admin@x.com'`);
const as = (uid, aal = "aal1") => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: uid, aal })}',false)`);
const su = () => db.exec(`reset role`);
const q = (s) => db.query(s);
const fails = async (fn, re) => { try { await fn(); } catch (e) { assert.match(String(e.message), re, "wrong error: " + e.message); return; } assert.fail("expected failure " + re); };
let n = 0; const ok = (m) => console.log(`ok ${++n} ${m}`);

// --- setup: a sender, campaign and two recipients for user A ---
await as(A);
const sid = (await q(`select save_sender_account('resend','My Resend','v1.cipher.text','hello@acme.com','Acme',null) id`)).rows[0].id;
const camp = (await q(`insert into campaigns(sender_id, name, subject, body) values ('${sid}','C1','Hi {{name}}','Body') returning id`)).rows[0].id;
const rec1 = (await q(`insert into campaign_recipients(campaign_id, email, name) values ('${camp}','lead1@x.com','Lead One') returning id`)).rows[0].id;
const rec2 = (await q(`insert into campaign_recipients(campaign_id, email, name) values ('${camp}','lead2@x.com','Lead Two') returning id`)).rows[0].id;

// --- tracking columns exist, tracking on by default ---
const cols = (await q(`select column_name from information_schema.columns where table_name='campaign_recipients' and column_name in ('opened_at','clicked_at','bounced_at','replied_at','resend_id')`)).rows.map((r) => r.column_name);
assert.deepEqual(cols.sort(), ["bounced_at", "clicked_at", "opened_at", "replied_at", "resend_id"]); ok("recipient timeline columns exist (opened/clicked/bounced/replied + resend_id)");
assert.equal((await q(`select tracking_enabled from campaigns where id='${camp}'`)).rows[0].tracking_enabled, true); ok("tracking is on by default for a campaign");

// --- event dedupe: same webhook replay stored once, repeat opens kept ---
// recordEvent() upserts on (recipient_id, type, external_id); the unique
// index is the idempotency mechanism, so it is tested here at the DB level.
const ins = (rec, type, ext) =>
  q(`insert into email_events(user_id, campaign_id, recipient_id, type, external_id) values ('${A}','${camp}','${rec}','${type}',${ext === null ? "null" : `'${ext}'`}) on conflict (recipient_id, type, external_id) do nothing`);
await ins(rec1, "opened", "evt_1");
await ins(rec1, "opened", "evt_1");
assert.equal((await q(`select count(*)::int c from email_events where recipient_id='${rec1}' and type='opened'`)).rows[0].c, 1);
ok("the same webhook event twice records one row (dedupe index = idempotency)");
await ins(rec1, "opened", null);
await ins(rec1, "opened", null);
assert.equal((await q(`select count(*)::int c from email_events where recipient_id='${rec1}' and type='opened'`)).rows[0].c, 3);
ok("repeat pixel opens (no external id) are still recorded, one row each");
await ins(rec1, "clicked", "evt_2");
assert.equal((await q(`select target_url from email_events where recipient_id='${rec1}' and type='clicked'`)).rows[0].target_url, null);
ok("a clicked event row is stored (target URL is written by the click route)");
await fails(() => q(`insert into email_events(user_id, campaign_id, recipient_id, type) values ('${A}','${camp}','${rec1}','not-a-type')`), /check constraint/);
ok("only the eight known event types can be stored");

// --- timeline columns are writable by the owner (routes stamp first-seen) ---
await q(`update campaign_recipients set opened_at=now() where id='${rec1}'`);
assert.ok((await q(`select opened_at from campaign_recipients where id='${rec1}'`)).rows[0].opened_at); ok("opened_at stamps on the recipient row");

// --- events RLS: owner-only, admin sees none ---
assert.equal((await q(`select count(*)::int c from email_events`)).rows[0].c, 4); ok("owner sees their own events");
await as(C);
assert.equal((await q(`select count(*)::int c from email_events`)).rows[0].c, 0);
await fails(() => q(`insert into email_events(user_id, campaign_id, recipient_id, type) values ('${A}','${camp}','${rec1}','opened')`), /permission denied|violates row-level security/);
ok("other users see no events and cannot insert into someone else's timeline");
await as(ADM, "aal2");
assert.equal((await q(`select count(*)::int c from email_events`)).rows[0].c, 0); ok("admins see NONE of a user's email events (same privacy rule as leads)");
await as(A);

// --- AI keys: save, never readable, owner-only ---
const kid = (await q(`select save_ai_key('gemini','v1.ai.cipher') id`)).rows[0].id;
assert.equal((await q(`select has_key from ai_keys where id='${kid}'`)).rows[0].has_key, true); ok("user saves a Gemini AI key, has_key = true");
await fails(() => q(`select api_key_enc from ai_keys`), /permission denied/); ok("browser can NEVER read the AI key column directly");
assert.equal((await q(`select get_ai_key('gemini') k`)).rows[0].k, "v1.ai.cipher"); ok("server route gets the AI ciphertext via RPC");
await q(`select set_ai_key_enabled('${kid}', false)`);
assert.equal((await q(`select get_ai_key('gemini') k`)).rows[0].k, null); ok("AI key switch OFF -> key not released");
await q(`select set_ai_key_enabled('${kid}', true)`);
await as(C);
assert.equal((await q(`select count(*)::int c from ai_keys`)).rows[0].c, 0);
assert.equal((await q(`select get_ai_key('gemini') k`)).rows[0].k, null); ok("other users cannot see or get this AI key");
await as(ADM, "aal2");
assert.equal((await q(`select count(*)::int c from ai_keys`)).rows[0].c, 0); ok("admins see NONE of a user's AI keys");
await as(A);

// --- validation backstop: a malformed address can never be stored ---
await fails(() => q(`insert into campaign_recipients(campaign_id, email, name) values ('${camp}','not-an-email','Bad')`), /check constraint/);
ok("the database rejects a malformed recipient address (invalid addresses can never be enqueued)");

console.log(`\nALL ${n} TRACKING DATABASE TESTS PASSED`);
