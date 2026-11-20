const BASE = "https://api.apify.com/v2";

export class ApifyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call(path: string, token: string, init: RequestInit = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, // token only in header, never in URL
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApifyError(0, "Could not reach Apify.");
  }
  if (!res.ok) {
    let msg = `Apify error ${res.status}`;
    try { const j: any = await res.json(); msg = j?.error?.message ?? msg; } catch { /* ignore */ }
    throw new ApifyError(res.status, msg);
  }
  return res.json();
}

export const apifyMe = (token: string) => call("/users/me", token);
export const startRun = async (token: string, actor: string, input: unknown) =>
  (await call(`/actors/${encodeURIComponent(actor)}/runs`, token, { method: "POST", body: JSON.stringify(input) })).data as { id: string; defaultDatasetId: string; status: string };
export const getRun = async (token: string, runId: string) =>
  (await call(`/actor-runs/${encodeURIComponent(runId)}`, token)).data as { id: string; status: string; statusMessage?: string };
export const getItems = async (token: string, datasetId: string, limit: number): Promise<unknown[]> =>
  call(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=${Math.max(1, Math.min(1000, limit))}`, token);

/** Friendly text for the user. Never includes the token. */
export function apifyMessage(e: unknown): string {
  if (!(e instanceof ApifyError)) return "Something went wrong talking to Apify.";
  if (e.status === 401 || e.status === 403) return "Apify rejected your API key. Check it in Integrations.";
  if (e.status === 402 || /usage|credit|limit|budget/i.test(e.message)) return "Your Apify account has no credit or usage left. Check your Apify billing page.";
  if (e.status === 429) return "Apify is busy right now. Try again in a minute.";
  if (e.status === 0) return "Could not reach Apify. Try again.";
  return "Apify could not start this run. Check your inputs and try again.";
}
