// Authenticated API client.
// Every call attaches the Auth0 bearer token from the current session.
// `getToken` is injected at initialisation time from the Auth0 hook.

let _getToken: (() => Promise<string>) | null = null;

export function initApiClient(getToken: () => Promise<string>) {
  _getToken = getToken;
}

const BASE = import.meta.env.VITE_API_URL ?? "";  // "" = same origin in dev

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (_getToken) {
    try {
      const token = await _getToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch {
      // Token fetch failed — request will hit the backend unauthenticated
    }
  }
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message ?? "Request failed"), {
      status: res.status,
      code: err.error,
    });
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
