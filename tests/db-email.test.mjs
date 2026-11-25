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

// --- senders: save, key never readable, owner-only release ---
await as(A);
const sid = (await q(`select save_sender_account('resend','My Resend','v1.cipher.text','hello@acme.com','Acme',null) id`)).rows[0].id;
assert.equal((await q(`select has_key from sender_accounts`)).rows[0].has_key, true); ok("user saves a Resend sender, has_key = true");
await fails(() => q(`select api_key_enc from sender_accounts`), /permission denied/); ok("browser can NEVER read the sender key column directly");
await fails(() => q(`insert into sender_accounts(provider,name,from_email) values ('resend','Hack','h@x.com')`), /permission denied/); ok("browser cannot insert a sender directly (RPC only)");
assert.equal((await q(`select get_sender_key('${sid}') k`)).rows[0].k, "v1.cipher.text"); ok("server route gets the sender ciphertext via RPC");
await q(`select set_sender_enabled('${sid}', false)`);
assert.equal((await q(`select get_sender_key('${sid}') k`)).rows[0].k, null); ok("sender switch OFF -> key not released");
await q(`select set_sender_enabled('${sid}', true)`);

await as(C);
assert.equal((await q(`select count(*)::int c from sender_accounts`)).rows[0].c, 0);
assert.equal((await q(`select get_sender_key('${sid}') k`)).rows[0].k, null); ok("other users cannot see or get this sender key");
await as(ADM, "aal2");
assert.equal((await q(`select count(*)::int c from sender_accounts`)).rows[0].c, 0); ok("admins see NONE of a user's senders (same privacy rule as leads)");

// --- usage: free plan daily limit ---
await as(A);
let u = (await q(`select * from my_email_usage()`)).rows[0];
assert.deepEqual([u.sent_today, u.lim], [0, 20]); ok("free plan: 20 emails per day, 0 sent");

// --- templates + campaigns + recipients: own rows only ---
await q(`insert into templates(name, subject, body) values ('T1','Hi {{name}}','Hello {{company}}')`);
assert.equal((await q(`select count(*)::int c from templates`)).rows[0].c, 1);
await as(C);
assert.equal((await q(`select count(*)::int c from templates`)).rows[0].c, 0); ok("templates are private to their owner");
await as(A);
const camp = (await q(`insert into campaigns(sender_id, name, subject, body) values ('${sid}','C1','Hi {{name}}','Body') returning id`)).rows[0].id;
await q(`insert into campaign_recipients(campaign_id, email, name) values ('${camp}','lead1@x.com','Lead One'), ('${camp}','lead2@x.com','Lead Two')`);
assert.equal((await q(`select count(*)::int c from campaign_recipients`)).rows[0].c, 2);
await as(C);
assert.equal((await q(`select count(*)::int c from campaigns`)).rows[0].c, 0);
assert.equal((await q(`select count(*)::int c from campaign_recipients`)).rows[0].c, 0); ok("campaigns and recipients are private to their owner");
await as(ADM, "aal2");
assert.equal((await q(`select count(*)::int c from campaigns`)).rows[0].c, 0); ok("admins see NONE of a user's campaigns");
await as(A);

// --- enqueue: only from 'sending', exactly once ---
await fails(() => q(`select enqueue_campaign('${camp}')`), /NOT_SENDING/); ok("cannot enqueue a draft campaign");
await q(`update campaigns set status='sending' where id='${camp}'`);
let enq = (await q(`select * from enqueue_campaign('${camp}')`)).rows[0];
assert.deepEqual([enq.queued, enq.skipped_suppressed], [2, 0]);
assert.equal((await q(`select count(*)::int c from email_queue`)).rows[0].c, 2); ok("enqueue moves 2 recipients into the queue, exactly once");
enq = (await q(`select * from enqueue_campaign('${camp}')`)).rows[0];
assert.equal(enq.queued, 0); ok("second enqueue queues nothing (idempotent)");
assert.equal((await q(`select count(*)::int c from campaign_recipients where status='queued'`)).rows[0].c, 2);

// --- claim: own jobs only, one claim wins ---
let claimed = (await q(`select * from claim_my_email_jobs(10)`)).rows;
assert.equal(claimed.length, 2); ok("claim takes both due jobs");
claimed = (await q(`select * from claim_my_email_jobs(10)`)).rows;
assert.equal(claimed.length, 0); ok("second claim finds nothing (already claimed)");
await as(C);
assert.equal((await q(`select * from claim_my_email_jobs(10)`)).rows.length, 0); ok("other users cannot claim these jobs");
await as(A);
// simulate the worker finishing: mark one sent, one failed-then-requeued
const job1 = (await q(`select recipient_id from email_queue order by created_at limit 1`)).rows[0].recipient_id;
await q(`update campaign_recipients set status='sent', sent_at=now() where id='${job1}'`);
await q(`update email_queue set status='sent' where recipient_id='${job1}'`);
u = (await q(`select * from my_email_usage()`)).rows[0];
assert.deepEqual([u.sent_today, u.lim], [1, 20]); ok("usage counts sent mail (1 of 20 today)");

// --- suppression: suppressed addresses are never enqueued ---
await q(`insert into suppression_list(email, reason) values ('lead2@x.com','unsubscribed')`);
await q(`insert into campaigns(sender_id, name, subject, body, status) values ('${sid}','C2','Hi','Body','sending') returning id`).then(async (r) => {
  const c2 = r.rows[0].id;
  await q(`insert into campaign_recipients(campaign_id, email, name) values ('${c2}','lead2@x.com','Lead Two'), ('${c2}','lead3@x.com','Lead Three')`);
  const e2 = (await q(`select * from enqueue_campaign('${c2}')`)).rows[0];
  assert.deepEqual([e2.queued, e2.skipped_suppressed], [1, 1]); ok("suppressed address is skipped at enqueue, never queued");
  assert.equal((await q(`select count(*)::int c from campaign_recipients where campaign_id='${c2}' and status='suppressed'`)).rows[0].c, 1);
});
await fails(() => q(`insert into suppression_list(email) values ('LEAD2@X.COM')`), /duplicate key/); ok("suppression is unique per user, case-insensitive");

// --- pro plan raises the daily limit ---
await su(); await q(`update profiles set plan='pro', plan_expires_at=now()+interval '5 days' where id='${A}'`); await as(A);
u = (await q(`select * from my_email_usage()`)).rows[0];
assert.deepEqual([u.sent_today, u.lim], [1, 500]); ok("pro plan: 500 emails per day");
console.log(`\nALL ${n} EMAIL DATABASE TESTS PASSED`);
