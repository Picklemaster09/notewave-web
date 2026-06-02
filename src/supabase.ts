import { SettingsConfig, RecordingNote } from "./types";
import { apiUrl } from "./config";
import { getAccessToken } from "./authToken";

export interface SupabaseUserSession {
  uid: string; // Auth0_id mapping compatible with your schema
  id: string;  // Internal Supabase users.id UUID
  email: string;
  displayName: string;
  tier: "free" | "premium";
  accessToken?: string; // Optional bearer access token for RLS session binding
}

export const isSupabaseEnabled = true;

/**
 * Builds the Authorization header for API calls. Authentication is handled
 * directly by Auth0 (SPA SDK); this attaches a fresh Auth0 access token so the
 * backend can identify the user. Falls back to any token on a legacy session
 * object for backwards compatibility.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  try {
    const saved = localStorage.getItem("notewave_user_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.accessToken) {
        return { Authorization: `Bearer ${parsed.accessToken}` };
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve user authorization session header:", e);
  }
  return {};
}

/**
 * Persists customized user settings to the user_settings Supabase table
 */
export async function supabaseSaveSettings(uid: string, settings: SettingsConfig): Promise<void> {
  const resp = await fetch(apiUrl("/api/user-settings"), {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(await getAuthHeaders())
    },
    body: JSON.stringify({
      uid,
      customApiKey: settings.customApiKey,
      tier: settings.tier,
      language: settings.language,
      theme: settings.theme,
      accentColor: settings.accentColor,
      actionButtonAction: settings.actionButtonAction,
    }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.message || data.error || "Failed to persist user settings.");
  }
}

/**
 * Downloads notes synced to Supabase
 */
export async function supabaseFetchNotes(uid: string): Promise<RecordingNote[]> {
  const resp = await fetch(apiUrl(`/api/notes?uid=${encodeURIComponent(uid)}`), {
    headers: {
      ...(await getAuthHeaders())
    }
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || data.error || "Failed to fetch cloud notes.");
  }
  return data.notes || [];
}

/**
 * Batch-updates backups of current notes list
 */
export async function supabaseSaveNotes(uid: string, notes: RecordingNote[]): Promise<void> {
  const resp = await fetch(apiUrl("/api/notes/sync"), {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(await getAuthHeaders())
    },
    body: JSON.stringify({ uid, notes }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.message || data.error || "Failed to backup notes database.");
  }
}

/**
 * Deletes a single note from Supabase
 */
export async function supabaseDeleteNote(uid: string, id: string): Promise<void> {
  const resp = await fetch(apiUrl(`/api/notes/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`), {
    method: "DELETE",
    headers: {
      ...(await getAuthHeaders())
    }
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.message || data.error || "Failed to delete cloud note.");
  }
}

/**
 * Deletes all user's notes from Supabase
 */
export async function supabaseDeleteAllNotes(uid: string): Promise<void> {
  const resp = await fetch(apiUrl(`/api/notes/all?uid=${encodeURIComponent(uid)}`), {
    method: "DELETE",
    headers: {
      ...(await getAuthHeaders())
    }
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.message || data.error || "Failed to wipe cloud database.");
  }
}
