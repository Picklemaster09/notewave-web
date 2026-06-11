// Bridge between the Auth0 React context (hooks) and the plain async API helpers
// in supabase.ts, which run outside of React and therefore can't call hooks.
//
// App.tsx registers a getter once Auth0 is ready; the API layer calls
// getAccessToken() to attach a fresh Auth0 access token to each request.
//
// The Auth0 SDK automatically handles token refresh via `getAccessTokenSilently()`.
// When the access token expires, the SDK uses the stored refresh token to obtain
// a new one without user interaction. If the refresh token is also expired, the
// SDK will attempt a silent authentication with Auth0's session cookie.
type TokenGetter = () => Promise<string | null | undefined>;

let tokenGetter: TokenGetter | null = null;

export function registerTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

/**
 * Fetch a fresh Auth0 access token, automatically handling token refresh.
 *
 * The Auth0 SDK's `getAccessTokenSilently()` handles the following scenarios:
 * 1. If the access token is still valid, return it immediately from cache.
 * 2. If the access token is expired but the refresh token is valid, use the
 *    refresh token to obtain a new access token.
 * 3. If both tokens are expired but the user has an active Auth0 session cookie,
 *    perform a silent authentication (popup-free) to get new tokens.
 * 4. If all else fails, throw an error that the caller can handle.
 *
 * This function wraps the call with retry logic to handle transient network
 * issues during token refresh.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  
  // Try up to 2 times to handle transient network issues during token refresh
  const maxRetries = 2;
  let lastError: unknown = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const token = await tokenGetter();
      if (token) return token;
      lastError = new Error("Token getter returned null/undefined");
    } catch (e: any) {
      lastError = e;
      
      // If this is a login_required error, the session is fully expired
      // and the user needs to re-authenticate manually
      if (e?.error === "login_required" || e?.error === "consent_required") {
        console.warn("Auth0 session expired — user needs to re-authenticate:", e);
        return null;
      }
      
      // For other errors, retry once after a short delay
      if (attempt < maxRetries - 1) {
        console.warn(
          `Failed to obtain Auth0 access token (attempt ${attempt + 1}/${maxRetries}), retrying...:`,
          e
        );
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  console.warn("Failed to obtain Auth0 access token after all retries:", lastError);
  return null;
}

/**
 * Check if the current token getter is configured and functional.
 * This can be used to determine if the user has an active Auth0 session.
 */
export async function hasValidTokenGetter(): Promise<boolean> {
  if (!tokenGetter) return false;
  try {
    const token = await getAccessToken();
    return token !== null;
  } catch {
    return false;
  }
}
