// Resend sending over plain HTTPS fetch — edge-safe in Cloudflare Workers,
// no SMTP library. The API key travels only in the Authorization header,
// never in a URL, a log line, or a response.
const BASE = "https://api.resend.com";

export class ResendError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type ResendSendInput = {
  from: string; to: string; subject: string;
  html: string; text?: string; replyTo?: string;
};

async function call(path: string, apiKey: string, init: RequestInit = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ResendError(0, "Could not reach Resend.");
  }
  if (!res.ok) {
    let msg = `Resend error ${res.status}`;
    try {
      const j: any = await res.json();
      msg = j?.message ?? j?.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new ResendError(res.status, msg);
  }
  return res.json().catch(() => ({}));
}

/** Send one email. Returns Resend's message id. */
export async function sendResend(apiKey: string, m: ResendSendInput): Promise<{ id: string }> {
  const body: Record<string, unknown> = { from: m.from, to: [m.to], subject: m.subject, html: m.html };
  if (m.text) body.text = m.text;
  if (m.replyTo) body.reply_to = m.replyTo;
  return call("/emails", apiKey, { method: "POST", body: JSON.stringify(body) });
}

/** Prove a key works before saving it: listing domains needs a valid key and sends nothing. */
export async function verifyResendKey(apiKey: string): Promise<boolean> {
  await call("/domains", apiKey);
  return true;
}

/** Friendly text for the user. Never includes the key. */
export function resendMessage(e: unknown): string {
  if (!(e instanceof ResendError)) return "Something went wrong talking to Resend.";
  if (e.status === 401 || e.status === 403) return "Resend rejected your API key. Check it in Email > Senders.";
  if (e.status === 402 || /credit|limit|quota|domain/i.test(e.message)) return "Resend could not send: check your Resend plan, credits, or that the sender domain is verified.";
  if (e.status === 422) return "Resend rejected this email (check the sender address and recipient).";
  if (e.status === 429) return "Resend is busy right now. The email will be retried automatically.";
  if (e.status === 0) return "Could not reach Resend. Try again.";
  return "Resend could not send this email. Try again later.";
}
