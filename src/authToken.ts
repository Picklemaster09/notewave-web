// Bridge between the Auth0 React context (hooks) and the plain async API helpers
// in supabase.ts, which run outside of React and therefore can't call hooks.
//
// App.tsx registers a getter once Auth0 is ready; the API layer calls
// getAccessToken() to attach a fresh Auth0 access token to each request.
type TokenGetter = () => Promise<string | null | undefined>;

let tokenGetter: TokenGetter | null = null;

export function registerTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export async function getAccessToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return (await tokenGetter()) ?? null;
  } catch (e) {
    console.warn("Failed to obtain Auth0 access token:", e);
    return null;
  }
}
