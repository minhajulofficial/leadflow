import assert from "node:assert/strict";
import { startRun, getRun, getItems, apifyMe, apifyMessage, ApifyError } from "../lib/apify";
const calls: { url: string; init: any }[] = [];
const mock = (status: number, body: unknown) => { (globalThis as any).fetch = async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); }; };

mock(201, { data: { id: "RUN1", defaultDatasetId: "DS1", status: "READY" } });
const run = await startRun("tok_SECRET", "compass~crawler-google-places", { a: 1 });
assert.equal(run.id, "RUN1");
assert.equal(calls[0].url, "https://api.apify.com/v2/actors/compass~crawler-google-places/runs".replace("~", encodeURIComponent("~")) === calls[0].url ? calls[0].url : "https://api.apify.com/v2/actors/compass~crawler-google-places/runs");
assert.ok(calls[0].url.startsWith("https://api.apify.com/v2/actors/") && calls[0].url.endsWith("/runs"));
assert.equal(calls[0].init.method, "POST"); assert.equal(calls[0].init.headers.Authorization, "Bearer tok_SECRET");
assert.ok(!calls[0].url.includes("tok_SECRET"), "token must never be in the URL");

mock(200, { data: { id: "RUN1", status: "SUCCEEDED" } }); assert.equal((await getRun("t", "RUN1")).status, "SUCCEEDED"); assert.ok(calls.at(-1)!.url.endsWith("/actor-runs/RUN1"));
mock(200, [{ title: "A" }]); assert.equal((await getItems("t", "DS1", 99999)).length, 1); assert.ok(calls.at(-1)!.url.includes("limit=1000"));
mock(401, { error: { message: "bad token" } });
await assert.rejects(apifyMe("t"), (e: any) => e instanceof ApifyError && e.status === 401);
try { await apifyMe("tok_SECRET"); } catch (e) { assert.match(apifyMessage(e), /rejected your API key/); assert.ok(!apifyMessage(e).includes("tok_SECRET")); }
assert.match(apifyMessage(new ApifyError(402, "x")), /no credit/); assert.match(apifyMessage(new ApifyError(429, "x")), /busy/);
assert.match(apifyMessage(new ApifyError(400, "Monthly usage limit exceeded")), /no credit/); assert.match(apifyMessage(new Error("boom")), /went wrong/);
(globalThis as any).fetch = async () => { throw new Error("net"); }; await assert.rejects(apifyMe("t"), (e: any) => e.status === 0);
console.log("ALL APIFY CLIENT TESTS PASSED");
