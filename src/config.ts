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
