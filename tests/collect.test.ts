import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { validateStart, buildApifyInput, mapPlace, processItems, apifyState, parseNiches } from "../lib/collect";
const none = { requireEmail: false, requirePhone: false, requireWebsite: false };

// ---- crypto
const k1 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const k2 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const ct = await encryptSecret("apify_api_SECRET123", k1);
assert.ok(ct.startsWith("v1.") && !ct.includes("SECRET123"));
assert.equal(await decryptSecret(ct, k1), "apify_api_SECRET123");
assert.notEqual(await encryptSecret("x", k1), await encryptSecret("x", k1), "random IV each time");
await assert.rejects(decryptSecret(ct, k2)); // wrong key
const parts = ct.split("."); parts[2] = parts[2].slice(0, -4) + "AAAA";
await assert.rejects(decryptSecret(parts.join("."), k1)); // tampered
await assert.rejects(encryptSecret("x", undefined), /ENCRYPTION_KEY_MISSING/);
await assert.rejects(encryptSecret("x", btoa("short")), /ENCRYPTION_KEY_INVALID/);
console.log("ok crypto: roundtrip, random IV, wrong key, tamper, missing/short key");

// ---- validation
const id = "11111111-1111-4111-8111-111111111111";
const good = { providerSlug: "apify-google-maps", directoryId: id, niches: ["dentist", " cafe "], countryCode: "BD", cityIds: [id], max: 20, rules: { requirePhone: true }, minRating: 4, minReviews: "10", maxReviews: null };
const v = validateStart(good, 20); assert.ok(v.ok); if (v.ok) { assert.equal(v.value.countryCode, "bd"); assert.equal(v.value.minReviews, 10); assert.equal(v.value.rules.requirePhone, true); assert.equal(v.value.rules.requireEmail, false); }
assert.match((validateStart({ ...good, max: 21 }, 20) as any).error, /allows up to 20/);
assert.ok(!validateStart({ ...good, niches: [] }, 20).ok);
assert.ok(!validateStart({ ...good, cityIds: [] }, 20).ok);
assert.ok(!validateStart({ ...good, cityIds: Array(6).fill(id) }, 20).ok);
assert.ok(!validateStart({ ...good, cityIds: ["x"] }, 20).ok);
assert.ok(!validateStart({ ...good, minRating: 9 }, 20).ok);
assert.ok(!validateStart({ ...good, minReviews: 50, maxReviews: 5 }, 20).ok);
assert.ok(!validateStart({ ...good, max: 1.5 }, 20).ok); assert.ok(!validateStart(null, 20).ok);
assert.deepEqual(parseNiches("a, b,a\n c,,d,e,f,g"), ["a", "b", "c", "d", "e"]);
console.log("ok validation");

// ---- apify input / mapping / filters
const inp = buildApifyInput({ niches: ["dentist", "cafe"], city: "Dhaka", country: "Bangladesh", countryCode: "BD", max: 20 });
assert.equal(inp.locationQuery, "Dhaka, Bangladesh"); assert.equal(inp.maxCrawledPlacesPerSearch, 10); assert.equal(inp.countryCode, "bd");
const items = [
  { title: "Smile Dental", phone: "+880 1712-345678", website: "smile.com", totalScore: 4.6, reviewsCount: 120, categoryName: "Dentist", address: "Road 1" },
  { title: "No Phone Cafe", website: "cafe.com", totalScore: 4.8, reviewsCount: 50 },
  { title: "Low Rated", phone: "01911111111", totalScore: 3.1, reviewsCount: 400 },
  { title: "Tiny", phone: "01811111111", totalScore: 4.9, reviewsCount: 2 },
  { title: "Huge Chain", phone: "01711111111", totalScore: 4.5, reviewsCount: 99999 },
  { error: "not a place" }, null, "junk",
];
const r = processItems(items, { country: "Bangladesh", city: "Dhaka" }, { rules: { ...none, requirePhone: true }, minRating: 4, minReviews: 10, maxReviews: 5000 }, 100);
assert.equal(r.leads.length, 1); assert.equal(r.leads[0].name, "Smile Dental"); assert.equal(r.leads[0].phone, "+8801712345678");
assert.equal(r.leads[0].website, "https://smile.com"); assert.equal(r.leads[0].country, "Bangladesh"); assert.equal(r.leads[0].city, "Dhaka"); assert.equal(r.leads[0].niche, "Dentist");
assert.equal(r.found, 5); assert.equal(r.filtered, 4);
assert.equal(processItems(items, { country: "B", city: "D" }, { rules: none, minRating: null, minReviews: null, maxReviews: null }, 2).leads.length, 2, "cap respected");
assert.deepEqual(mapPlace({ title: "X", emails: ["A@b.com"], facebooks: ["https://fb.com/x"] }, { country: "C", city: "D" }).email, "A@b.com");
assert.equal(apifyState("SUCCEEDED"), "ready"); assert.equal(apifyState("RUNNING"), "running"); assert.equal(apifyState("READY"), "running"); assert.equal(apifyState("TIMED-OUT"), "failed"); assert.equal(apifyState("FAILED"), "failed");
console.log("ok apify input, mapping, filters, run states\n\nALL COLLECT LOGIC TESTS PASSED");
