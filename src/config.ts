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
// Landing vs app split.
//
// Default (VITE_APP_URL empty): same-origin PATH mode. The landing/demo lives at
// the site root and the signed-in dashboard lives under "/app" — works on GitHub
// Pages (paired with the 404.html SPA fallback emitted by the build).
//
// Set VITE_APP_URL to a SEPARATE origin (e.g. https://app.example.com) to switch
// to SUBDOMAIN mode: landing on the root domain, dashboard on the app subdomain.
// Either way, login always resolves on the app location so the (per-origin)
// Auth0 session is created where the dashboard runs.
// ---------------------------------------------------------------------------
export const APP_URL = (import.meta.env.VITE_APP_URL ?? "").replace(/\/+$/, "");

const base = import.meta.env.BASE_URL; // e.g. "/" or "/notewave-web/"
const origin = typeof window !== "undefined" ? window.location.origin : "";
const appPath = `${base.replace(/\/$/, "")}/app`;

let appHref: string;
let onLanding: boolean;

if (APP_URL) {
  let appUrlOrigin = "";
  try {
    appUrlOrigin = new URL(APP_URL).origin;
  } catch {
    /* ignore malformed URL */
  }
  appHref = APP_URL;
  if (appUrlOrigin && appUrlOrigin !== origin) {
    // Subdomain mode: the app lives on another origin, so this is the landing.
    onLanding = true;
  } else {
    // A same-origin URL was given — treat it as a path target.
    const here = origin ? window.location.href.replace(/\/+$/, "") : "";
    onLanding = !here.startsWith(APP_URL);
  }
} else {
  // Default path mode on the current origin: app lives under "/app".
  appHref = origin + appPath;
  onLanding = typeof window === "undefined" ? false : !window.location.pathname.startsWith(appPath);
}

/** Absolute URL where the signed-in app lives. */
export const APP_HREF = appHref;
/** Absolute URL of the public landing page. */
export const LANDING_HREF = origin + base;
/** True when the current page should render the landing/demo (not the app). */
export const isLandingHost = onLanding;
