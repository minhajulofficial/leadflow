import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Terms of Service · LeadFlow" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of LeadFlow ({LEGAL.domain}), operated by {LEGAL.companyName}
        ({LEGAL.companyAddress}). By creating an account you agree to them. Contact: {LEGAL.supportEmail}.
      </p>
      <h2>What LeadFlow does</h2>
      <p>
        LeadFlow collects business leads from public directories (through your own Apify account), helps you
        organise them, and sends email campaigns through your own Resend sender account. Free accounts get
        100 leads per month and 20 results per collection run; Pro accounts get 5,000 leads per month and
        500 results per run, plus email tools as they launch. Limits are enforced by the service, not just
        the interface.
      </p>
      <h2>Plans and payments</h2>
      <ul>
        <li><strong>Free — ৳0.</strong> No card needed.</li>
        <li><strong>Pro — ৳999 per 30 days.</strong> Paid manually by bKash or Nagad: you send the payment to the number shown on the billing page, then submit the transaction ID (TrxID). An admin reviews it and activates or extends Pro by 30 days from the current expiry. Approval is human-speed; the target is a median under 12 hours.</li>
        <li>Pro is a subscription in 30-day blocks. It does not auto-renew: when it expires you go back to Free until you pay again. Cancelling means simply not paying again — there is nothing to cancel.</li>
        <li>Refunds are covered by the separate Refund Policy.</li>
      </ul>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Collect only public business data, and follow each directory&apos;s terms of service and local laws (see the Acceptable Use Policy).</li>
        <li>Keep your sign-in details safe. You are responsible for what happens on your account.</li>
        <li>Your Apify, Resend, and AI-provider accounts are yours: their costs, limits, and terms are between you and those providers. LeadFlow never pays them on your behalf.</li>
        <li>Outreach must follow anti-spam and data-protection rules: honest sender identity, a working unsubscribe link, and no mail to people who asked to stop (the suppression list is enforced automatically).</li>
      </ul>
      <h2>What we promise — and what we do not</h2>
      <p>
        We aim to keep the service available and your data safe (encrypted provider keys, row-level access
        rules so users cannot see each other&apos;s data). We do not promise uninterrupted availability: the
        service runs on free-tier infrastructure at launch, databases can pause after inactivity, and
        third-party providers (Apify, Resend, Supabase, Cloudflare) can have their own outages. Email open
        and click counts are approximate by nature (some mail clients block tracking pixels). The AI writer
        drafts text; it never guarantees inbox placement.
      </p>
      <h2>Fair use and suspension</h2>
      <p>
        We may suspend an account that breaks the Acceptable Use Policy, abuses the service, or tries to
        access other users&apos; data. Paid time remaining at suspension is handled under the Refund Policy.
      </p>
      <h2>Your data</h2>
      <p>
        Your leads, campaigns, and keys belong to you. Export them any time from Settings → Account, and
        delete your account there too (see the Privacy Policy for exactly what deletion removes and keeps).
      </p>
      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, our liability is limited to
        the amount you paid us in the 30 days before the claim. We are not liable for the actions of
        Apify, Resend, Supabase, Cloudflare, or any AI provider you connect.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms; the &ldquo;Last updated&rdquo; date above changes and continued use after a
        change means you accept the new terms. If a change affects paid users materially, we will say so on
        the billing page.
      </p>
    </LegalPage>
  );
}
