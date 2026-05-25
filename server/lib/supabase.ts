import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes("placeholder")) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Check your .env.local file."
    );
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── User helpers ─────────────────────────────────────────────────────────────

export async function upsertUser(auth0Id: string, email?: string) {
  const { data, error } = await db()
    .from("users")
    .upsert(
      { auth0_id: auth0Id, email: email ?? null, updated_at: new Date().toISOString() },
      { onConflict: "auth0_id", ignoreDuplicates: false }
    )
    .select("id, auth0_id, email, plan, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getUserByAuth0Id(auth0Id: string) {
  const { data, error } = await db()
    .from("users")
    .select("id, auth0_id, email, plan, created_at")
    .eq("auth0_id", auth0Id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}

// ── Notes helpers ────────────────────────────────────────────────────────────

export async function getNotesByUserId(userId: string) {
  const { data, error } = await db()
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertNote(note: Record<string, unknown>) {
  const { data, error } = await db()
    .from("notes")
    .upsert(note, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(noteId: string, userId: string) {
  const { error } = await db()
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ── Settings helpers ─────────────────────────────────────────────────────────

export async function getSettings(userId: string) {
  const { data, error } = await db()
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}

export async function upsertSettings(userId: string, settings: Record<string, unknown>) {
  const { data, error } = await db()
    .from("user_settings")
    .upsert(
      { user_id: userId, ...settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Usage tracking ───────────────────────────────────────────────────────────

export async function recordUsageEvent(userId: string, eventType: string) {
  const { error } = await db()
    .from("usage_events")
    .insert({ user_id: userId, event_type: eventType });

  if (error) console.error("Usage event insert failed:", error);
}

export async function getUsageCount(userId: string, eventType: string, since: Date) {
  const { count, error } = await db()
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", since.toISOString());

  if (error) throw error;
  return count ?? 0;
}
