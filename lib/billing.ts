export function validatePayment(sender: string, trx: string): string | null {
  const s = sender.replace(/[\s-]/g, "");
  if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(s)) return "Enter the mobile number you sent the money from (e.g. 01712345678).";
  const t = trx.trim();
  if (!/^[A-Za-z0-9]{6,40}$/.test(t)) return "TrxID should be 6-40 letters/numbers, copy it from your payment SMS.";
  return null;
}
export function paymentError(message: string, code?: string): string {
  if (code === "23505" || /duplicate/i.test(message)) return "This TrxID was already submitted.";
  if (message.includes("TOO_MANY_PENDING")) return "You already have 3 payments waiting for review.";
  if (message.includes("METHOD_UNAVAILABLE")) return "That payment method is not available right now.";
  if (message.includes("NOT_A_PAID_PLAN")) return "That plan does not need payment.";
  if (message.includes("BAD_TRX")) return "TrxID looks invalid.";
  return "Could not submit payment. Please try again.";
}
