import { SettingsConfig, RecordingNote } from "./types";

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
 * Extracts the user's secure registration access token from localStorage for RLS compliance
 */
function getAuthHeader(): Record<string, string> {
  try {
    const saved = localStorage.getItem("notewave_user_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.accessToken) {
        return { "Authorization": `Bearer ${parsed.accessToken}` };
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve user authorization session header:", e);
  }
  return {};
}

/**
 * Registers a new secure user profile within the Supabase Auth system and public SQL tables
 */
export async function supabaseRegister(email: string, password: string, displayName: string): Promise<SupabaseUserSession> {
  const resp = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || data.error || "Failed to register user account.");
  }
  return data.user;
}

/**
 * Authenticates user credentials via password challenge
 */
export async function supabaseLogin(email: string, password: string): Promise<{ user: SupabaseUserSession; settings?: any }> {
  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || data.error || "Failed to authenticate credentials.");
  }
  return { user: data.user, settings: data.settings };
}

/**
 * Persists customized user settings to the user_settings Supabase table
 */
export async function supabaseSaveSettings(uid: string, settings: SettingsConfig): Promise<void> {
  const resp = await fetch("/api/user-settings", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeader()
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
  const resp = await fetch(`/api/notes?uid=${encodeURIComponent(uid)}`, {
    headers: {
      ...getAuthHeader()
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
  const resp = await fetch("/api/notes/sync", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeader()
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
  const resp = await fetch(`/api/notes/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader()
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
  const resp = await fetch(`/api/notes/all?uid=${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader()
    }
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.message || data.error || "Failed to wipe cloud database.");
  }
}
