// Central frontend configuration.
//
// The NoteWave backend API (AI transcription, the AI agent, and all Supabase-backed
// data) lives behind Cloudflare at this origin. The frontend is deployed separately
// (static site), so every API call must target an absolute URL rather than a
// same-origin relative path.
//
// Override per-environment with a VITE_API_BASE_URL entry in .env if needed
// (e.g. when pointing the local dev server at a staging API).
const DEFAULT_API_BASE = "https://napi.ccma-fetch.space";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");

/** Build an absolute API URL from a root-relative path such as "/api/notes". */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// ---------------------------------------------------------------------------
// Two-host setup (optional).
//
// When VITE_APP_URL points to a SEPARATE origin (e.g. https://app.example.com),
// the landing/demo lives on the current root origin and the signed-in dashboard
// lives on the app origin. Sign-in redirects the user to the app origin.
//
// When VITE_APP_URL is empty (or equals the current origin), everything runs as
// a single page: the landing shows when logged out, the dashboard when logged in.
// ---------------------------------------------------------------------------
export const APP_URL = (import.meta.env.VITE_APP_URL ?? "").replace(/\/+$/, "");

const appOrigin = (() => {
  try {
    return APP_URL ? new URL(APP_URL).origin : "";
  } catch {
    return "";
  }
})();

/** True when a separate app origin is configured and we're currently NOT on it
 * (i.e. we're on the landing/root host). */
export const isLandingHost =
  !!appOrigin && typeof window !== "undefined" && window.location.origin !== appOrigin;
