/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute origin of the NoteWave backend API (AI + Supabase access). */
  readonly VITE_API_BASE_URL?: string;
  /** Auth0 tenant domain, e.g. "your-tenant.eu.auth0.com". */
  readonly VITE_AUTH0_DOMAIN?: string;
  /** Auth0 SPA application Client ID. */
  readonly VITE_AUTH0_CLIENT_ID?: string;
  /** Auth0 API audience (identifier of the API that accepts the access token). */
  readonly VITE_AUTH0_AUDIENCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
