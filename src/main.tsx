import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Auth0Provider} from '@auth0/auth0-react';
import App from './App.tsx';
import {APP_HREF} from './config';
import './index.css';

// Public Auth0 SPA config — these are identifiers, not secrets, and ship safely
// in the bundle (the real protection is Auth0's Allowed Callback URLs). Override
// via VITE_ env vars at build time if needed.
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || "";
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || "";
// Optional: set once you create an Auth0 API so the access token is a JWT for your backend.
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

// Authentication is handled directly by Auth0 in the browser (Universal Login,
// PKCE — no client secret). Tokens are cached so sessions survive reloads.
const tree = auth0Domain && auth0ClientId ? (
  <Auth0Provider
    domain={auth0Domain}
    clientId={auth0ClientId}
    authorizationParams={{
      // Login resolves on the app location (the "/app" path, or the app
      // subdomain once VITE_APP_URL is set) so the session lands there.
      redirect_uri: APP_HREF,
      ...(auth0Audience ? {audience: auth0Audience} : {}),
    }}
    cacheLocation="localstorage"
    useRefreshTokens
    useRefreshTokensFallback
  >
    <App />
  </Auth0Provider>
) : (
  // Falls back to rendering the app without auth when Auth0 env vars are absent
  // (e.g. a misconfigured build) so the page still loads with a clear console hint.
  <App />
);

if (!auth0Domain || !auth0ClientId) {
  console.warn(
    'Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in your .env to enable login.'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{tree}</StrictMode>,
);
