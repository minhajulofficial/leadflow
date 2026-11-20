import { mapRow, cleanLead, toCSV, isEmail } from "../lib/leads";
import assert from "node:assert/strict";
const none = { requireEmail: false, requirePhone: false, requireWebsite: false };

// header aliases
const m = mapRow({ "Business Name": "Acme", "E-mail": " A@B.com ", Mobile: "+880 1712-345678", URL: "acme.com", Category: "Cafe" });
assert.equal(m.name, "Acme"); assert.equal(m.email, "A@B.com"); assert.equal(m.niche, "Cafe");

// cleaning
let r = cleanLead(m, none).lead!;
assert.equal(r.email, "a@b.com"); assert.equal(r.phone, "+8801712345678"); assert.equal(r.website, "https://acme.com");

// bad data dropped, rules enforced
assert.equal(cleanLead({ name: "X", email: "not-an-email" }, { ...none, requireEmail: true }).reason, "no email");
assert.equal(cleanLead({ name: "X", phone: "12" }, { ...none, requirePhone: true }).reason, "no phone");
assert.equal(cleanLead({}, none).reason, "empty");
assert.equal(cleanLead({ website: "javascript:alert(1)" }, none).lead?.website, undefined);
assert.equal(isEmail("a@b"), false);

// CSV: quoting + formula injection
const csv = toCSV([{ name: '=HYPERLINK("x")', city: 'Dhaka, BD' }, { name: "Ok", city: 'say "hi"' }], ["name", "city"]);
assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`)); assert.ok(csv.includes('"Dhaka, BD"')); assert.ok(csv.includes('"say ""hi"""'));
console.log("all lead logic tests passed");
