// Minimal Stripe REST client using plain fetch (no `stripe` npm package).

function appendFormValue(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(params, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      appendFormValue(params, `${key}[${childKey}]`, childValue);
    }
    return;
  }
  params.append(key, String(value));
}

export function toStripeForm(body: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    appendFormValue(params, key, value);
  }
  return params;
}

export function getStripeSecretKey(): string | null {
  return process.env["STRIPE_SECRET_KEY"] ?? null;
}

export class StripeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function stripeFetch(secretKey: string, path: string, init: RequestInit) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error?.message ?? `Stripe request failed with status ${response.status}`;
    throw new StripeApiError(message, response.status);
  }
  return payload;
}

export async function createCheckoutSession(secretKey: string, body: Record<string, unknown>) {
  return stripeFetch(secretKey, "checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: toStripeForm(body).toString(),
  });
}

export async function retrieveCheckoutSession(secretKey: string, sessionId: string) {
  return stripeFetch(secretKey, `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
}
