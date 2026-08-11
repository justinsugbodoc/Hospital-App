// Shared HTTP helpers for the ported SugboDoc API routes.

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    return (body ?? {}) as T;
  } catch {
    return {} as T;
  }
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
