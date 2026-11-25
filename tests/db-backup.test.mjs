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
const A = await mk("a@x.com"), B = await mk("b@x.com"), ADM = await mk("admin@x.com");
await db.exec(`update public.profiles set role='admin' where email='admin@x.com'`);
const as = (uid, aal = "aal1") => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: uid, aal })}',false)`);
const su = () => db.exec(`reset role`);
const q = (s, p) => db.query(s, p);
let n = 0; const ok = (m) => console.log(`ok ${++n} ${m}`);

// --- fixture rows for user A (one per owned table) + a control row for B ---
await su();
const leadA = (await q(`insert into leads(user_id, name, email, city, country, niche) values ('${A}','Acme Dental','lead@acme.com','Dhaka','Bangladesh','dentists') returning id`)).rows[0].id;
const leadB = (await q(`insert into leads(user_id, name, email) values ('${B}','Other Co','other@x.com') returning id`)).rows[0].id;
await q(`insert into lead_runs(user_id, provider_slug, label) values ('${A}','apify-google-maps','dentists Dhaka')`);
await q(`update payment_methods set active = true where name = 'bKash'`); // the insert trigger requires an active method
await q(`insert into payments(user_id, plan, amount, method, sender_number, trx_id) values ('${A}','pro',999,'bKash','01700000000','TRX-A1')`);
await q(`insert into user_provider_settings(user_id, provider_slug, enabled) values ('${A}','apify-google-maps', true)`);
const senderA = (await q(`insert into sender_accounts(user_id, provider, name, from_email) values ('${A}','resend','Main','hello@acme.com') returning id`)).rows[0].id;
await q(`insert into templates(user_id, name, subject, body) values ('${A}','T1','Hi','Body')`);
const campA = (await q(`insert into campaigns(user_id, sender_id, name, subject, body) values ('${A}','${senderA}','C1','Hi','Body') returning id`)).rows[0].id;
const recA = (await q(`insert into campaign_recipients(campaign_id, user_id, email, name) values ('${campA}','${A}','lead@acme.com','Acme') returning id`)).rows[0].id;
await q(`insert into email_queue(recipient_id, campaign_id, user_id) values ('${recA}','${campA}','${A}')`);
await q(`insert into email_events(recipient_id, campaign_id, user_id, type) values ('${recA}','${campA}','${A}','sent')`);
await q(`insert into suppression_list(user_id, email, reason) values ('${A}','spam@x.com','unsubscribed')`);
await q(`insert into ai_keys(user_id, provider) values ('${A}','gemini')`);
await q(`insert into audit_logs(actor, action, detail) values ('${A}','test_action','{}')`);
ok("fixture rows exist for user A across every owned table");

// --- export round-trip: dump -> delete -> re-insert -> counts match ---
const GENERATED = new Set(["email_key", "has_key"]);
async function exportTable(table, where) {
  return (await q(`select * from ${table} where ${where}`)).rows;
}
async function reinsert(table, rows) {
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => !GENERATED.has(c));
    const vals = cols.map((c) => row[c]);
    await q(`insert into ${table} (${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")})`, vals);
  }
}
// Children first: deleting a campaign cascades to its recipients, queue
// rows and events, so the round-trip must visit those tables first.
for (const [table, where] of [
  ["email_events", `user_id='${A}'`],
  ["campaign_recipients", `user_id='${A}'`],
  ["leads", `user_id='${A}'`],
  ["campaigns", `user_id='${A}'`],
  ["payments", `user_id='${A}'`],
]) {
  const before = await exportTable(table, where);
  const exported = JSON.parse(JSON.stringify(before)); // the JSON file, as the script writes it
  assert.ok(exported.length >= 1, `${table}: nothing to export`);
  await q(`delete from ${table} where ${where}`);
  assert.equal((await q(`select count(*)::int c from ${table} where ${where}`)).rows[0].c, 0);
  await reinsert(table, exported);
  const after = await exportTable(table, where);
  assert.equal(after.length, before.length, `${table}: row count changed across the round-trip`);
  assert.equal(after[0].id, before[0].id, `${table}: row identity changed across the round-trip`);
  ok(`export -> delete -> re-insert round-trips ${table} (${before.length} row${before.length > 1 ? "s" : ""}, counts match)`);
}

// --- account deletion: the exact order in lib/account.ts ACCOUNT_DELETE_TABLES ---
const DELETE_TABLES = ["email_queue", "email_events", "campaign_recipients", "campaigns", "templates", "sender_accounts", "suppression_list", "ai_keys", "lead_runs", "leads", "user_provider_settings", "profiles"];
for (const table of DELETE_TABLES) {
  const col = table === "profiles" ? "id" : "user_id";
  await q(`delete from ${table} where ${col}='${A}'`);
}
for (const table of DELETE_TABLES) {
  const col = table === "profiles" ? "id" : "user_id";
  assert.equal((await q(`select count(*)::int c from ${table} where ${col}='${A}'`)).rows[0].c, 0, `${table}: user A rows survive deletion`);
}
ok("deletion removes every user-owned row, children first, profile last");

// --- retention: payments + audit log survive; the other user is untouched ---
assert.equal((await q(`select count(*)::int c from payments where user_id='${A}'`)).rows[0].c, 1);
assert.equal((await q(`select count(*)::int c from audit_logs where actor='${A}'`)).rows[0].c, 1);
ok("payments and audit log are RETAINED for user A (refund window + deletion record)");
assert.equal((await q(`select count(*)::int c from leads where id='${leadB}'`)).rows[0].c, 1);
assert.equal((await q(`select count(*)::int c from profiles where id='${B}'`)).rows[0].c, 1);
ok("user B is untouched by user A's deletion");

// --- admin still exists (the last-admin rule is enforced in the route, not the DB) ---
assert.equal((await q(`select count(*)::int c from profiles where role='admin'`)).rows[0].c, 1);
ok("one admin remains after the deletion");

console.log(`ALL ${n} BACKUP DATABASE TESTS PASSED`);
