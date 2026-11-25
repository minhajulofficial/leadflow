import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Privacy Policy · LeadFlow" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        LeadFlow ({LEGAL.domain}) is a lead-collection and email-outreach tool. This policy explains what
        data we collect, why, and what you can do about it. The service is operated by {LEGAL.companyName}
        ({LEGAL.companyAddress}). Contact: {LEGAL.supportEmail}.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address, name (if you give one), and plan. Needed to sign you in and run the service.</li>
        <li><strong>Provider keys:</strong> your Apify, Resend, and AI-provider API keys. They are encrypted with AES-256-GCM before storage and are never shown back to the browser or written to logs.</li>
        <li><strong>Leads you collect or import:</strong> business names, contact details, ratings, and the filters you used. This is business data you asked us to collect for you; you are responsible for collecting only public business data and for following each directory&apos;s terms of service and local laws.</li>
        <li><strong>Email outreach data:</strong> your sender accounts, templates, campaigns, recipients, send events (sent, delivered, opened, clicked, bounced, replied), and suppression entries. Open and click tracking uses a 1-pixel image and signed links; it never shares your data with anyone else.</li>
        <li><strong>Payments:</strong> bKash or Nagad payments are manual. We store the plan, amount, your sender number, and the transaction ID (TrxID) so an admin can approve the payment. We never see your mobile-banking PIN or password.</li>
        <li><strong>Technical data:</strong> sign-in records and error reports needed to keep the service running. We run no advertising trackers.</li>
      </ul>
      <h2>Sub-processors (who else touches your data)</h2>
      <ul>
        <li><strong>Supabase</strong> — database and authentication (stores everything above).</li>
        <li><strong>Cloudflare</strong> — hosting (runs the app).</li>
        <li><strong>Apify</strong> — collects business listings from Google Maps, using your own Apify account.</li>
        <li><strong>Resend</strong> — sends your campaign emails, using your own Resend sender account.</li>
        <li><strong>Google / OpenAI</strong> — only if you connect your own AI key for the AI writer; your drafts go to the provider you chose.</li>
        <li><strong>Sentry</strong> — error monitoring, only if the operator enables it; error reports contain no lead or email content.</li>
      </ul>
      <h2>What we never do</h2>
      <p>
        We never sell your data, never share your leads or campaigns with other users, and admins cannot see
        your leads, senders, campaigns, or email events. Your data is yours: export it any time from
        Settings → Account, and delete your account there too. Deleting your account removes your leads,
        keys, runs, campaigns, and email data; payment records are kept for the refund window (see the
        Refund Policy) and the audit log keeps the deletion itself recorded.
      </p>
      <h2>Retention</h2>
      <p>
        Your data is kept while your account exists. If you delete your account, your data is deleted as
        described above. Payment records are kept for up to 90 days after deletion, then removed on request.
        Backups (if enabled by the operator) are overwritten on their normal rotation cycle.
      </p>
      <h2>Your rights</h2>
      <p>
        You can export all of your data (Settings → Account → Export my data), correct your profile, and
        delete your account at any time. To ask a question about your data, write to {LEGAL.supportEmail}.
      </p>
      <h2>Cookies</h2>
      <p>
        We use only the cookies needed to keep you signed in. There are no advertising or cross-site
        tracking cookies.
      </p>
      <h2>Changes</h2>
      <p>If this policy changes, the &ldquo;Last updated&rdquo; date above changes and the new version applies from that date.</p>
    </LegalPage>
  );
}
