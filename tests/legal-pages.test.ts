import assert from "node:assert/strict";
import fs from "node:fs";

let n = 0;
const ok = (m: string) => console.log(`ok ${++n} ${m}`);
const read = (p: string) => fs.readFileSync(p, "utf8");

// --- all five legal pages exist and carry real, product-specific copy ---
const pages: Record<string, string[]> = {
  "app/privacy/page.tsx": ["Privacy Policy", "Apify", "Resend", "Supabase", "bKash", "export", "delete your account"],
  "app/terms/page.tsx": ["Terms of Service", "999", "bKash", "Nagad", "TrxID", "30 days"],
  "app/acceptable-use/page.tsx": ["Acceptable Use", "public business data", "unsubscribe"],
  "app/refund/page.tsx": ["Refund Policy", "999", "7 days", "TrxID", "DRAFT"],
  "app/dpa/page.tsx": ["Data Processing Addendum", "controller", "processor", "Sub-processors", "Supabase", "Cloudflare"],
};
for (const [file, needles] of Object.entries(pages)) {
  assert.ok(fs.existsSync(file), `${file} missing`);
  const text = read(file);
  for (const needle of needles) assert.ok(text.includes(needle), `${file} lacks "${needle}"`);
}
ok("all five legal pages exist with product-specific copy");

// --- placeholders are used, never invented company details ---
for (const file of Object.keys(pages)) {
  const text = read(file);
  assert.ok(!/Minhajul|LeadFlow Ltd|hello@leadflow/i.test(text.replace(/LeadFlow \(/g, "")), `${file} invents company details`);
}
const legal = read("lib/legal.ts");
assert.ok(legal.includes('"[COMPANY NAME]"') && legal.includes('"[SUPPORT EMAIL]"') && legal.includes('"[COMPANY ADDRESS]"'));
ok("company/support details are placeholders in one place (lib/legal.ts), nowhere invented");

// --- the refund policy is flagged DRAFT (Q6 unanswered) ---
assert.ok(read("app/refund/page.tsx").includes("DRAFT"), "refund page must say DRAFT until Q6 is answered");
assert.ok(read("app/refund/page.tsx").includes("Q6"), "refund page must name the open question");
ok("refund policy is visibly a draft pending the owner's answer (Q6)");

// --- footer links: landing + dashboard both link all five pages ---
const landing = read("app/page.tsx");
const shell = read("components/shell.tsx");
for (const href of ["/privacy", "/terms", "/acceptable-use", "/refund", "/dpa"]) {
  assert.ok(landing.includes(`href="${href}"`), `landing footer lacks ${href}`);
  assert.ok(shell.includes(`href="${href}"`), `dashboard footer lacks ${href}`);
}
ok("landing footer and dashboard footer link all five legal pages");

// --- settings page exists and links export + deletion ---
assert.ok(fs.existsSync("app/dashboard/settings/page.tsx"));
assert.ok(fs.existsSync("app/dashboard/settings/settings-client.tsx"));
assert.ok(read("components/shell.tsx").includes("/dashboard/settings"), "shell nav lacks Settings");
assert.ok(read("app/dashboard/settings/settings-client.tsx").includes("DELETE"), "settings client lacks the DELETE confirmation");
ok("Settings page exists, is in the nav, and has export + DELETE confirmation");

// --- robots.txt blocks private areas, sitemap lists public pages only ---
const robots = read("public/robots.txt");
for (const dis of ["Disallow: /dashboard/", "Disallow: /admin/", "Disallow: /api/"]) {
  assert.ok(robots.includes(dis), `robots.txt lacks "${dis}"`);
}
assert.ok(robots.includes("Sitemap:"), "robots.txt must point at the sitemap");
const sitemap = read("public/sitemap.xml");
for (const pub of ["/privacy", "/terms", "/acceptable-use", "/refund", "/dpa", "/login"]) {
  assert.ok(sitemap.includes(pub), `sitemap lacks ${pub}`);
}
assert.ok(!sitemap.includes("/dashboard") && !sitemap.includes("/admin") && !sitemap.includes("/api/"), "sitemap must not list private URLs");
ok("robots.txt blocks private areas; sitemap lists public pages only");

console.log(`ALL ${n} LEGAL-PAGES TESTS PASSED`);
