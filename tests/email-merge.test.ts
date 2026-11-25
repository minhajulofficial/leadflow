import { applyMerge, extractMergeFields, unknownMergeFields, MERGE_FIELDS } from "../lib/email/merge";
import assert from "node:assert/strict";

const lead = { name: "Rafi", company: "Acme Studio", city: "Dhaka", country: "Bangladesh", email: "rafi@acme.com" };

// basic replacement, spaces tolerated, case-insensitive field names
assert.equal(applyMerge("Hi {{name}}, from {{ company }} in {{CITY}}.", lead), "Hi Rafi, from Acme Studio in Dhaka.");
// unknown fields become empty, never left as {{...}}
assert.equal(applyMerge("Hello {{unknown}}!", lead), "Hello !");
// missing values become empty
assert.equal(applyMerge("Hi {{phone}}.", lead), "Hi .");
// HTML body: values are escaped so lead data cannot break markup
assert.equal(applyMerge("<p>{{company}}</p>", { company: 'A<B> & "Co"' }, true), "<p>A&lt;B&gt; &amp; &quot;Co&quot;</p>");
// subject/plain text: no escaping
assert.equal(applyMerge("{{company}}", { company: 'A<B>' }, false), "A<B>");
// field extraction + unknown detection
assert.deepEqual(extractMergeFields("{{name}} and {{ name }} and {{city}}"), ["name", "city"]);
assert.deepEqual(unknownMergeFields("Hi {{name}}, see {{website}} and {{bogus}}"), ["bogus"]);
assert.deepEqual(unknownMergeFields("No fields here"), []);
assert.ok(MERGE_FIELDS.includes("email"));
console.log("all email merge tests passed");
