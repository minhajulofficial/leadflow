import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Refund Policy · LeadFlow" };

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund Policy"
      draft="This policy is a DRAFT. The refund window and the conditions below have not been approved by the owner yet (open question Q6). Do not treat it as final until the draft notice is removed."
    >
      <p>
        LeadFlow Pro costs <strong>৳999 per 30 days</strong>, paid manually by bKash or Nagad. You send the
        payment to the number on the billing page and submit the transaction ID (TrxID); an admin approves it
        and Pro is activated or extended by 30 days. Contact: {LEGAL.supportEmail}.
      </p>
      <h2>Refund window (draft)</h2>
      <p>
        You may ask for a refund <strong>within 7 days of Pro being activated</strong>, if the account has
        not used paid features in that period (no collection runs beyond the Free limit, no email campaigns
        sent). After 7 days, or after paid features have been used, the payment is not refundable — Pro
        simply runs to its expiry date and does not renew.
      </p>
      <h2>How to ask for a refund (draft)</h2>
      <ul>
        <li>Write to {LEGAL.supportEmail} from the email address on your LeadFlow account.</li>
        <li>Include your TrxID, the amount, and the bKash/Nagad number you paid from.</li>
        <li>We reply within 2 business days. Approved refunds go back to the same bKash/Nagad number within 7 business days.</li>
      </ul>
      <h2>When a refund is not available (draft)</h2>
      <ul>
        <li>The 7-day window has passed.</li>
        <li>Paid features were used (collection runs or campaigns beyond the Free plan).</li>
        <li>The account was suspended for breaking the Acceptable Use Policy.</li>
        <li>The payment was made to the wrong number or without a TrxID we can verify — in that case we help you trace it, but we cannot refund money we never received.</li>
      </ul>
      <h2>Failed or duplicate payments</h2>
      <p>
        If a payment was charged twice by mistake, or a payment was approved but Pro never activated, write
        to {LEGAL.supportEmail} with the TrxID — those cases are refunded in full regardless of the window.
      </p>
      <h2>Cancelling</h2>
      <p>
        There is nothing to cancel: Pro never auto-renews. If you do not pay again, the account returns to
        the Free plan at expiry and your leads and data stay where they are.
      </p>
    </LegalPage>
  );
}
