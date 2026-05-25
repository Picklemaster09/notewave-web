import { useAuth0, RedirectLoginOptions } from "@auth0/auth0-react";

export { Auth0Provider } from "@auth0/auth0-react";

// Public environment variables — safe to include in frontend bundle.
// Set these in .env.local (never commit real values).
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN as string,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID as string,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
    scope: "openid profile email",
  },
};

// Thin wrapper around useAuth0 so the rest of the app doesn't import from
// @auth0/auth0-react directly — easier to swap later if needed.
export function useAuth() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  // Optionally forward Auth0 options, e.g. a specific social connection or a
  // signup hint, so the landing page can drive Google vs. email sign-up.
  const login = (options?: RedirectLoginOptions) => loginWithRedirect(options);

  const signOut = () =>
    logout({ logoutParams: { returnTo: window.location.origin } });

  return {
    isAuthenticated,
    isLoading,
    user,           // Auth0 user profile (name, email, picture, sub)
    login,
    signOut,
    getAccessTokenSilently,
  };
}
