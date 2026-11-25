import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Data Processing Addendum · LeadFlow" };

export default function DpaPage() {
  return (
    <LegalPage title="Data Processing Addendum">
      <p>
        This addendum explains how LeadFlow ({LEGAL.domain}), operated by {LEGAL.companyName}
        ({LEGAL.companyAddress}), processes personal data on behalf of its users. It applies together with
        the Privacy Policy. Contact: {LEGAL.supportEmail}.
      </p>
      <h2>Roles</h2>
      <p>
        <strong>You (the user) are the controller</strong> of the business data you collect and the email
        addresses you contact: you decide what to collect and who to email.
        <strong> LeadFlow is the processor</strong> for that data — we store and handle it only as needed
        to run the service, on your instructions (your clicks in the app and your campaign settings).
        For your own account data (email, name, plan), LeadFlow is the controller.
      </p>
      <h2>What is processed</h2>
      <ul>
        <li><strong>Categories:</strong> business contact details (names, business emails, phones, websites, addresses, ratings), your account details, your campaign content, and send/open/click events.</li>
        <li><strong>People concerned:</strong> you, and the businesses you collect or contact.</li>
        <li><strong>Purpose:</strong> lead collection, organisation, and email outreach, exactly as the service describes.</li>
      </ul>
      <h2>Sub-processors</h2>
      <p>We use these sub-processors, and no others, for the purposes listed:</p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication.</li>
        <li><strong>Cloudflare</strong> — hosting and delivery.</li>
        <li><strong>Apify</strong> — business-listing collection, using your own Apify account.</li>
        <li><strong>Resend</strong> — email delivery, using your own Resend sender account.</li>
        <li><strong>Google / OpenAI</strong> — AI writing, only if you connect your own key.</li>
        <li><strong>Sentry</strong> — error monitoring, only if the operator enables it.</li>
      </ul>
      <p>
        If a sub-processor changes, this page is updated and the &ldquo;Last updated&rdquo; date changes.
      </p>
      <h2>Security measures</h2>
      <ul>
        <li>Provider API keys are encrypted with AES-256-GCM before storage; the encryption key lives only as a server secret.</li>
        <li>Row-level access rules in the database: a user can only see their own rows; admins cannot see users&apos; leads, senders, campaigns, or email events.</li>
        <li>Admin access requires two-step verification (TOTP).</li>
        <li>Sign-in is handled by Supabase Auth; passwords are never stored by LeadFlow itself.</li>
      </ul>
      <h2>Your instructions and your rights</h2>
      <p>
        You instruct processing by using the service. You can export all of your data and delete your
        account from Settings → Account; deletion removes your leads, keys, runs, campaigns, and email data
        (payment records are kept for the refund window — see the Privacy Policy). Sub-processors delete
        data on their own schedules once we stop sending it to them.
      </p>
      <h2>Breaches and assistance</h2>
      <p>
        If we become aware of a personal-data breach affecting your data, we will tell you at
        {LEGAL.supportEmail} without undue delay, with what happened and what we are doing about it. We
        will help you answer questions from the people you contacted, within what the service can show.
      </p>
      <h2>International transfers</h2>
      <p>
        Sub-processors may store data outside your country (Supabase, Cloudflare, Resend, and AI providers
        operate globally). By using the service you accept that your data is processed where those providers
        operate, under their own terms.
      </p>
      <p>
        <em>
          Note: this addendum is a plain-language template for a small service, not legal advice. If your
          use needs a signed DPA (for example a company customer asking for one), write to{" "}
          {LEGAL.supportEmail}.
        </em>
      </p>
    </LegalPage>
  );
}
