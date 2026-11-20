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

await as(A);
assert.equal((await q(`select count(*)::int c from providers`)).rows[0].c, 1);
assert.ok((await q(`select count(*)::int c from cities`)).rows[0].c > 20); ok("user can read providers, directories, countries, cities");
await fails(() => q(`update providers set enabled=false`).then(r => { if (!r.affectedRows) throw new Error("row-level security (0 rows)"); }), /row-level security/); ok("user cannot switch a provider off");
await fails(() => q(`insert into cities(country_code,name) values ('bd','Hack')`), /row-level security/); ok("user cannot add locations");

await fails(() => q(`select set_provider_enabled('apify-google-maps', true)`), /NO_KEY/); ok("cannot enable a provider without a key");
await q(`select save_provider_key('apify-google-maps','v1.cipher.text')`); ok("user saves encrypted key");
await fails(() => q(`select api_key_enc from user_provider_settings`), /permission denied/); ok("browser can NEVER read the key column directly");
assert.equal((await q(`select has_key from user_provider_settings`)).rows[0].has_key, true); ok("browser can see only 'has_key = true'");
await fails(() => q(`update user_provider_settings set api_key_enc='x'`), /permission denied/); ok("browser cannot overwrite the key column directly");
assert.equal((await q(`select get_provider_key('apify-google-maps') k`)).rows[0].k, "v1.cipher.text"); ok("server route gets the ciphertext via RPC");

await as(C);
assert.equal((await q(`select get_provider_key('apify-google-maps') k`)).rows[0].k, null);
assert.equal((await q(`select count(*)::int c from user_provider_settings`)).rows[0].c, 0); ok("other users cannot see or get this key");

await as(A); await q(`select set_provider_enabled('apify-google-maps', false)`);
assert.equal((await q(`select get_provider_key('apify-google-maps') k`)).rows[0].k, null); ok("user switch OFF -> key not released");
await q(`select set_provider_enabled('apify-google-maps', true)`);

await as(ADM, "aal1");
await fails(() => q(`update providers set enabled=false`).then(r => { if (!r.affectedRows) throw new Error("row-level security (0 rows)"); }), /row-level security/); ok("admin without MFA cannot change providers");
await as(ADM, "aal2"); await q(`update providers set enabled=false`);
await as(A);
assert.equal((await q(`select get_provider_key('apify-google-maps') k`)).rows[0].k, null);
assert.equal((await q(`select count(*)::int c from providers`)).rows[0].c, 0); ok("admin switch OFF -> hidden from users and key not released");
await as(ADM, "aal2"); await q(`insert into cities(country_code,name) values ('bd','Barishal')`); await q(`update providers set enabled=true`); ok("admin with MFA manages locations/providers");

await as(A);
assert.equal((await q(`select my_plan_limits() l`)).rows[0].l.max_per_run, 20); ok("free plan: max 20 results per run");
await q(`insert into lead_runs(provider_slug,label) values ('apify-google-maps','t')`);
await fails(() => q(`insert into lead_runs(provider_slug,status) values ('apify-google-maps','succeeded')`), /row-level security/); ok("cannot fake a finished run on insert");
await as(C); assert.equal((await q(`select count(*)::int c from lead_runs`)).rows[0].c, 0); ok("runs are private to their owner");
await su(); await q(`update profiles set plan='pro', plan_expires_at=now()+interval '5 days' where id='${A}'`); await as(A);
assert.equal((await q(`select my_plan_limits() l`)).rows[0].l.max_per_run, 500); ok("pro plan: max 500 results per run");
console.log(`\nALL ${n} COLLECT DATABASE TESTS PASSED`);
