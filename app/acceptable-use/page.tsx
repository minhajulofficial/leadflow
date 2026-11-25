import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Acceptable Use Policy · LeadFlow" };

export default function AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable Use Policy">
      <p>
        LeadFlow is a tool for finding and contacting businesses that might become your clients. These rules
        keep it usable for everyone. Breaking them can lead to suspension (see the Terms of Service).
      </p>
      <h2>Collection</h2>
      <ul>
        <li>Collect only <strong>public business data</strong> — information a business has published about itself (name, phone, website, address, public reviews).</li>
        <li>Do not collect private personal data (home addresses, personal phone numbers, private emails) and do not use LeadFlow to stalk, harass, or dox anyone.</li>
        <li>Follow each directory&apos;s terms of service and local laws where you and the businesses operate.</li>
        <li>Do not try to bypass the service&apos;s limits (monthly lead caps, results per run, daily email caps) or access other users&apos; data.</li>
      </ul>
      <h2>Email outreach</h2>
      <ul>
        <li>Only email businesses in the course of genuine business outreach. No bulk spam, no purchased lists, no mail to people who never had a public business presence.</li>
        <li>Use an honest sender identity — your real name or business, and a sender address you control.</li>
        <li>Every campaign carries a working unsubscribe link. Do not remove it, and never email an address on your suppression list.</li>
        <li>Do not send unlawful, deceptive, or misleading content, and do not impersonate another business or person.</li>
      </ul>
      <h2>Security</h2>
      <ul>
        <li>Do not probe the service for vulnerabilities, try to break its access rules, or automate sign-ups or sign-ins.</li>
        <li>If you find a security problem, report it to {LEGAL.supportEmail} instead of exploiting it.</li>
      </ul>
      <h2>Enforcement</h2>
      <p>
        We may warn, suspend, or delete accounts that break this policy. If you believe an account was
        actioned in error, write to {LEGAL.supportEmail}.
      </p>
    </LegalPage>
  );
}
