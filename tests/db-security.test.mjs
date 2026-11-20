import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs"; import assert from "node:assert/strict";
const db = new PGlite();
const dir = "./supabase/migrations/";
await db.exec(`
 create role anon nologin; create role authenticated nologin;
 create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
 grant usage on schema auth to authenticated, anon;
 grant usage on schema public to authenticated, anon;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 alter default privileges in schema public grant all on functions to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(dir + f, "utf8"));
const A = (await db.query(`insert into auth.users(email) values ('a@x.com') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users(email) values ('admin@x.com') returning id`)).rows[0].id;
await db.exec(`update public.profiles set role='admin' where email='admin@x.com'`);
await db.exec(`update public.payment_methods set active=true, account_number='01700000000' where name='bKash'`);

const as = async (uid, aal = "aal1") => { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: uid, aal })}',false)`); };
const su = () => db.exec(`reset role`);
const fails = async (fn, re) => { try { await fn(); } catch (e) { assert.match(String(e.message), re, "wrong error: " + e.message); return; } assert.fail("expected failure " + re); };
const q = (s, p) => db.query(s, p);
let n = 0; const ok = (m) => console.log(`ok ${++n} ${m}`);

await as(A);
await q(`insert into leads(name,email,phone) values ('L1','a@b.com','+8801711111111')`); ok("user inserts own lead (user_id defaults to auth.uid)");
await fails(() => q(`insert into leads(name,email) values ('L2','A@B.com')`), /duplicate key/); ok("duplicate email (case-insensitive) blocked");
await fails(() => q(`insert into leads(name,phone) values ('L3','+8801711111111')`), /duplicate key/); ok("duplicate phone blocked");
await fails(() => q(`insert into leads(user_id,name) values ('${B}','steal')`), /row-level security/); ok("cannot insert a lead for another user");
await fails(() => q(`update profiles set role='admin' where id='${A}'`), /permission denied/); ok("user cannot make self admin");
await fails(() => q(`update profiles set plan='pro' where id='${A}'`), /permission denied/); ok("user cannot self-upgrade plan");
await fails(() => q(`update profiles set plan_expires_at=now()+interval '999 days' where id='${A}'`), /permission denied/); ok("user cannot edit plan expiry");

await as(B, "aal2"); assert.equal((await q(`select count(*)::int c from leads`)).rows[0].c, 0); ok("admin sees none of user's leads (leads are private)");
await as(A);
for (let i = 0; i < 99; i++) await q(`insert into leads(name,email) values ('x','u${i}@t.com')`);
await fails(() => q(`insert into leads(name,email) values ('over','over@t.com')`), /PLAN_LIMIT/); ok("free plan limit (100/month) enforced by the database");

// payments
await q(`insert into payments(plan,amount,method,sender_number,trx_id) values ('pro',1,'bKash','01711111111',' abc12345 ')`);
const pay = (await q(`select * from payments`)).rows[0];
assert.equal(pay.amount, 999); assert.equal(pay.trx_id, "ABC12345"); assert.equal(pay.status, "pending"); ok("amount forced to plan price, TrxID normalised, status pending");
await fails(() => q(`insert into payments(plan,method,sender_number,trx_id,status) values ('pro','bKash','01711111111','ABC12345','pending')`), /duplicate key/); ok("same TrxID cannot be reused");
await fails(() => q(`insert into payments(plan,method,sender_number,trx_id) values ('free','bKash','01711111111','ZZZ99999')`), /NOT_A_PAID_PLAN/); ok("cannot pay for free plan");
await fails(() => q(`insert into payments(plan,method,sender_number,trx_id) values ('pro','Nagad','01711111111','NNN99999')`), /METHOD_UNAVAILABLE/); ok("inactive payment method refused");
await q(`insert into payments(plan,method,sender_number,trx_id,status) values ('pro','bKash','01711111111','APPR9999','approved')`);
assert.equal((await q(`select status from payments where trx_id='APPR9999'`)).rows[0].status, "pending"); ok("user cannot sneak in an 'approved' payment (forced to pending)");
await q(`update payments set status='approved' where id='${pay.id}'`); assert.equal((await q(`select status from payments`)).rows[0].status, "pending"); ok("user cannot approve own payment (update affects 0 rows)");
await fails(() => q(`select admin_review_payment('${pay.id}', true)`), /FORBIDDEN/); ok("normal user cannot call admin RPC");

await as(B, "aal1");
await fails(() => q(`select admin_review_payment('${pay.id}', true)`), /FORBIDDEN/); ok("admin WITHOUT 2-step verification is refused");
await as(A);
await fails(() => q(`select admin_set_plan('${A}','pro',30)`), /FORBIDDEN/); ok("normal user cannot call admin_set_plan");
await as(B, "aal2");
await q(`select admin_review_payment('${pay.id}', true, 'ok')`); ok("admin with MFA approves payment");
await fails(() => q(`select admin_review_payment('${pay.id}', true)`), /NOT_PENDING/); ok("payment cannot be approved twice");
await su(); const prof = (await q(`select plan, plan_expires_at from profiles where id='${A}'`)).rows[0];
assert.equal(prof.plan, "pro"); const days = (new Date(prof.plan_expires_at) - Date.now()) / 864e5; assert.ok(days > 29 && days < 31); ok("user upgraded to Pro for ~30 days");
assert.equal((await q(`select count(*)::int c from audit_logs where action='payment_approved'`)).rows[0].c, 1); ok("audit log written");

await as(A);
await q(`insert into leads(name,email) values ('after','after@t.com')`); ok("Pro limit (5000) now applies, 101st lead allowed");
await su(); await q(`update profiles set plan_expires_at = now() - interval '1 day' where id='${A}'`); await as(A);
await fails(() => q(`insert into leads(name,email) values ('exp','exp@t.com')`), /PLAN_LIMIT/); ok("expired Pro falls back to Free limits");
await fails(() => q(`select * from audit_logs`).then(r => assert.equal(r.rows.length, 0)).then(() => { throw new Error("PASS-THROUGH"); }), /PASS-THROUGH/); ok("normal user sees no audit logs");
await fails(() => q(`insert into payment_methods(name,account_number) values ('Hack','1')`), /row-level security/); ok("user cannot edit payment methods");
assert.equal((await q(`select count(*)::int c from payment_methods`)).rows[0].c, 1); ok("user sees only ACTIVE payment methods");
console.log(`\nALL ${n} DATABASE SECURITY TESTS PASSED`);
