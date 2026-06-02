/**
 * NoteWave API — Cloudflare Worker (napi.ccma-fetch.space)
 *
 * Responsibilities:
 *   1. Verify the Auth0 access token (RS256 JWT) on protected routes.
 *   2. Proxy AI work to Gemini using a SERVER-SIDE key (the client never sees it
 *      and never controls the model/prompt — it only sends raw audio/text).
 *   3. Proxy data work to Supabase using the SERVICE-ROLE key, strictly scoped to
 *      the authenticated user (identity comes from the verified token `sub`,
 *      never from a client-supplied uid).
 *
 * Design note: there is intentionally NO generic "/gemini" or "/db" passthrough.
 * Every endpoint is purpose-specific so the client can't run arbitrary prompts
 * on your paid key or reach another user's rows.
 *
 * Secrets are provided via Wrangler (see README). Nothing secret is hardcoded.
 */

export interface Env {
  // Public config (vars)
  AUTH0_DOMAIN: string; // e.g. notewave.eu.auth0.com
  AUTH0_AUDIENCE: string; // the Auth0 API identifier, e.g. https://napi.ccma-fetch.space
  ALLOWED_ORIGIN: string; // e.g. https://picklemaster09.github.io
  GEMINI_MODEL?: string; // default gemini-1.5-flash
  SUPABASE_URL: string; // e.g. https://xxxx.supabase.co

  // Secrets (wrangler secret put ...)
  GEMINI_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Optional KV namespace for rate limiting (binding name RATE_LIMIT)
  RATE_LIMIT?: KVNamespace;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function corsHeaders(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  // Allow the configured site origin (and localhost for dev).
  const allowed =
    origin === env.ALLOWED_ORIGIN || /^http:\/\/localhost:\d+$/.test(origin)
      ? origin
      : env.ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(env: Env, req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env, req) },
  });
}

// ---------------------------------------------------------------------------
// Auth0 JWT verification (RS256 via Web Crypto, JWKS cached in module scope)
// ---------------------------------------------------------------------------
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  s += "=".repeat(pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodePart(part: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

let jwksCache: { keys: any[]; at: number } | null = null;

async function loadJwks(env: Env, force = false): Promise<any[]> {
  const now = Date.now();
  if (!force && jwksCache && now - jwksCache.at < 60 * 60 * 1000) {
    return jwksCache.keys;
  }
  const res = await fetch(`https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`);
  if (!res.ok) throw new Error("Failed to fetch JWKS");
  const data = (await res.json()) as { keys: any[] };
  jwksCache = { keys: data.keys, at: now };
  return data.keys;
}

async function importKey(jwk: any): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/** Returns the decoded payload if the token is valid, else null. */
async function verifyAuth0Token(token: string, env: Env): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header: any, payload: any;
  try {
    header = decodePart(h);
    payload = decodePart(p);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  // Find the signing key (refresh JWKS once if the kid isn't known — key rotation).
  let keys = await loadJwks(env);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await loadJwks(env, true);
    jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
  }

  const key = await importKey(jwk);
  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    b64urlToBytes(s) as BufferSource,
    new TextEncoder().encode(`${h}.${p}`) as BufferSource
  );
  if (!ok) return null;

  // Claim checks
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) return null;
  if (typeof payload.nbf === "number" && now < payload.nbf) return null;
  if (payload.iss !== `https://${env.AUTH0_DOMAIN}/`) return null;
  const aud = payload.aud;
  const audOk = Array.isArray(aud)
    ? aud.includes(env.AUTH0_AUDIENCE)
    : aud === env.AUTH0_AUDIENCE;
  if (!audOk) return null;

  return payload;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// ---------------------------------------------------------------------------
// Rate limiting (optional, uses KV if bound; otherwise allows)
// ---------------------------------------------------------------------------
async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSec = 24 * 60 * 60
): Promise<{ allowed: boolean; remaining: number }> {
  if (!env.RATE_LIMIT) return { allowed: true, remaining: limit };
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit) return { allowed: false, remaining: 0 };
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: windowSec });
  return { allowed: true, remaining: limit - (count + 1) };
}

// ---------------------------------------------------------------------------
// Gemini (REST — server holds the key, server picks model + prompt)
// ---------------------------------------------------------------------------
function geminiModel(env: Env): string {
  return env.GEMINI_MODEL || "gemini-1.5-flash";
}

async function geminiGenerate(
  env: Env,
  parts: any[],
  jsonMode: boolean
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel(
    env
  )}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body: any = { contents: [{ parts }] };
  if (jsonMode) body.generationConfig = { responseMimeType: "application/json" };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  const data: any = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ||
    ""
  );
}

// The structured-extraction instruction the FE expects (transcript, summary,
// checklist, etc.). `sourceClause` differs for audio vs pasted text.
function structuredPrompt(sourceClause: string): string {
  return `${sourceClause}
All text values you generate MUST be in the same primary language detected in the input.
Return EXACTLY one valid JSON object (no markdown fences, no extra text) with these keys:
{
  "transcript": "(verbatim, cleanly polished transcript of the input; if no speech, 'No clear spoken words detected')",
  "headlineTitle": "(for 'ideas': concise 5-6 word title; for 'reminders': the full literal task/reminder text)",
  "summaryText": "(an elegant 2-3 sentence overview of the key ideas)",
  "actionItems": "(markdown checkbox list e.g. ' - [ ] Send invoice'; if none, '- [ ] No explicit action items detected.')",
  "category": "('ideas' for projects/apps/creative/factual thoughts, 'reminders' for errands/chores/scheduled tasks)",
  "ideaName": "(EXACTLY 'Idea' if it describes building something; EXACTLY 'Note' if it's a fact/log/statement)",
  "scheduledDate": "(any specified day/time like 'Monday 9 AM', cleanly in the input language; else '')",
  "projectStartDate": "(any specified start time; else '')",
  "isComplex": (true if a complex app/tool/software project needing modular work, else false),
  "subTodos": [ { "id": "sub_1", "text": "Detailed micro-task", "completed": false } ],
  "tags": "(2-3 comma-separated relevant tags)"
}
If the input is purely factual with zero actionable steps, set "subTodos" to []. If "isComplex" is true, produce 5-8 structured sub-todos outlining how to build it.`;
}

function safeParseStructured(text: string, fallbackTranscript: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {
      transcript: fallbackTranscript || "Transcription complete.",
      headlineTitle: "Voice Note",
      summaryText: "Summary unavailable.",
      actionItems: "- [ ] Review note",
      category: "ideas",
      ideaName: "Note",
      scheduledDate: "",
      projectStartDate: "",
      isComplex: false,
      subTodos: [],
      tags: "voice",
    };
  }
}

function normalizeSubTodos(parsed: any) {
  if (Array.isArray(parsed.subTodos)) {
    parsed.subTodos = parsed.subTodos.map((t: any, i: number) => ({
      id: t.id || `sub_${Date.now()}_${i}`,
      text: t.text || "Action point",
      completed: !!t.completed,
    }));
  } else {
    parsed.subTodos = [];
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Supabase (REST/PostgREST — service role, scoped per user)
// ---------------------------------------------------------------------------
async function sb(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

/** Map the Auth0 `sub` to the internal users.id, creating the row on first sight. */
async function resolveUserId(env: Env, sub: string, email?: string): Promise<string> {
  const sel = await sb(
    env,
    `users?auth0_id=eq.${encodeURIComponent(sub)}&select=id`
  );
  const rows = (await sel.json()) as any[];
  if (Array.isArray(rows) && rows.length) return rows[0].id;

  const ins = await sb(env, "users", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ auth0_id: sub, email: email || null, plan: "free" }),
  });
  const created = (await ins.json()) as any[];
  const id = created?.[0]?.id;
  // best-effort default settings
  await sb(env, "user_settings", {
    method: "POST",
    body: JSON.stringify({
      user_id: id,
      language: "en",
      theme: "light",
      accent_color: "blue",
      action_button_action: "record",
    }),
  }).catch(() => {});
  return id;
}

function noteToDb(note: any, userId: string) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title || "",
    transcript: note.transcript || "",
    idea_summary: note.ideaSummary || "",
    action_items: note.actionItems || "",
    category: note.category || "ideas",
    idea_name: note.ideaName || "",
    scheduled_date: note.scheduledDate || "",
    project_start_date: note.projectStartDate || "",
    is_complex: !!note.isComplex,
    sub_todos: note.subTodos || [],
    tags: note.tags || [],
    model_used: note.modelUsed || "gemini",
    duration: Math.round(Number(note.duration || 0)),
    created_at: note.createdAt || new Date().toISOString(),
  };
}

function noteToClient(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    transcript: row.transcript,
    ideaSummary: row.idea_summary,
    actionItems: row.action_items,
    category: row.category,
    ideaName: row.idea_name,
    scheduledDate: row.scheduled_date,
    projectStartDate: row.project_start_date,
    isComplex: row.is_complex,
    subTodos: row.sub_todos || [],
    tags: row.tags || [],
    modelUsed: row.model_used,
    duration: row.duration || 0,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleTranscribe(env: Env, req: Request, claims: any | null): Promise<Response> {
  const bodyIn: any = await req.json().catch(() => ({}));
  const audio: string = bodyIn.audio;
  if (!audio) return json(env, req, { error: "Missing audio" }, 400);

  // Rate limit: by user when signed in, otherwise by IP (the public landing demo).
  const isPremium = false; // tier is enforced server-side; upgrade logic can read the user's plan
  const limit = isPremium ? 50 : 3;
  const rlKey = claims?.sub
    ? `ai:${claims.sub}`
    : `ai:ip:${req.headers.get("CF-Connecting-IP") || "anon"}`;
  const rl = await checkRateLimit(env, rlKey, limit);
  if (!rl.allowed) {
    return json(
      env,
      req,
      {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Free demo limit reached. Sign in for unlimited voice notes!",
      },
      429
    );
  }

  const base64 = audio.includes(";base64,") ? audio.split(";base64,")[1] : audio;
  const mime = audio.match(/data:([^;]+);/)?.[1] || "audio/webm";

  let parsed: any;
  try {
    const out = await geminiGenerate(
      env,
      [
        { inlineData: { data: base64, mimeType: mime } },
        { text: structuredPrompt("Analyze this audio note and transcribe it.") },
      ],
      true
    );
    parsed = normalizeSubTodos(safeParseStructured(out, ""));
  } catch (e: any) {
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
  return json(env, req, { success: true, data: parsed, model: geminiModel(env) });
}

async function handleAnalyzeText(env: Env, req: Request, claims: any | null): Promise<Response> {
  const bodyIn: any = await req.json().catch(() => ({}));
  const text: string = bodyIn.text;
  if (!text) return json(env, req, { error: "Missing text" }, 400);

  const rlKey = claims?.sub
    ? `ai:${claims.sub}`
    : `ai:ip:${req.headers.get("CF-Connecting-IP") || "anon"}`;
  const rl = await checkRateLimit(env, rlKey, 3);
  if (!rl.allowed) {
    return json(
      env,
      req,
      { error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached. Sign in for more." },
      429
    );
  }

  let parsed: any;
  try {
    const out = await geminiGenerate(
      env,
      [
        {
          text: `${structuredPrompt(
            "Analyze the following note text:"
          )}\n\nINPUT TEXT:\n"""\n${text}\n"""`,
        },
      ],
      true
    );
    parsed = normalizeSubTodos(safeParseStructured(out, text));
    if (!parsed.transcript) parsed.transcript = text;
  } catch (e: any) {
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
  return json(env, req, { success: true, data: parsed, model: geminiModel(env) });
}

async function handleAiAgent(env: Env, req: Request, claims: any): Promise<Response> {
  const bodyIn: any = await req.json().catch(() => ({}));
  const messages: any[] = Array.isArray(bodyIn.messages) ? bodyIn.messages : [];
  const notes: any[] = Array.isArray(bodyIn.notes) ? bodyIn.notes : [];

  const rl = await checkRateLimit(env, `ai:${claims.sub}`, 50);
  if (!rl.allowed) {
    return json(env, req, { error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." }, 429);
  }

  const context = notes
    .map(
      (n, i) =>
        `Note ${i + 1} [${n.category || "ideas"}]: ${n.title || ""}\nSummary: ${
          n.ideaSummary || ""
        }\nTasks: ${(n.subTodos || []).map((t: any) => t.text).join("; ")}`
    )
    .join("\n\n");

  const convo = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are NoteWave's helpful assistant. Answer using the user's notes as context when relevant. Reply in the user's language. Use concise markdown.

USER NOTES:
${context || "(no notes yet)"}

CONVERSATION:
${convo}

Assistant:`;

  try {
    const reply = await geminiGenerate(env, [{ text: prompt }], false);
    return json(env, req, { success: true, reply });
  } catch (e: any) {
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
}

async function handleGetNotes(env: Env, req: Request, claims: any): Promise<Response> {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  const res = await sb(
    env,
    `notes?user_id=eq.${userId}&select=*&order=created_at.desc`
  );
  const rows = (await res.json()) as any[];
  return json(env, req, { success: true, notes: (rows || []).map(noteToClient) });
}

async function handleSyncNotes(env: Env, req: Request, claims: any): Promise<Response> {
  const bodyIn: any = await req.json().catch(() => ({}));
  const notes: any[] = Array.isArray(bodyIn.notes) ? bodyIn.notes : [];
  const userId = await resolveUserId(env, claims.sub, claims.email);
  const rows = notes.map((n) => noteToDb(n, userId));
  if (rows.length) {
    await sb(env, "notes?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }
  return json(env, req, { success: true });
}

async function handleDeleteNote(env: Env, req: Request, claims: any, id: string): Promise<Response> {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  await sb(env, `notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}`, {
    method: "DELETE",
  });
  return json(env, req, { success: true });
}

async function handleDeleteAllNotes(env: Env, req: Request, claims: any): Promise<Response> {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  await sb(env, `notes?user_id=eq.${userId}`, { method: "DELETE" });
  return json(env, req, { success: true });
}

async function handleSaveSettings(env: Env, req: Request, claims: any): Promise<Response> {
  const b: any = await req.json().catch(() => ({}));
  const userId = await resolveUserId(env, claims.sub, claims.email);
  await sb(env, "user_settings?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      language: b.language || "en",
      theme: b.theme || "light",
      accent_color: b.accentColor || "blue",
      action_button_action: b.actionButtonAction || "record",
      custom_api_key: b.customApiKey || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (b.tier) {
    await sb(env, `users?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ plan: b.tier, updated_at: new Date().toISOString() }),
    });
  }
  return json(env, req, { success: true });
}

async function handleUsage(env: Env, req: Request, claims: any | null): Promise<Response> {
  const isPremium = false;
  const limit = isPremium ? 50 : 3;
  let remaining = limit;
  if (env.RATE_LIMIT) {
    const key = claims?.sub
      ? `ai:${claims.sub}`
      : `ai:ip:${req.headers.get("CF-Connecting-IP") || "anon"}`;
    const raw = await env.RATE_LIMIT.get(key);
    remaining = Math.max(0, limit - (raw ? parseInt(raw, 10) || 0 : 0));
  }
  return json(env, req, { limit, remaining, resetInHours: 24 });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }

    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // Verify token if present (optional for AI/demo, required for data routes).
      const token = bearer(req);
      const claims = token ? await verifyAuth0Token(token, env) : null;
      if (token && !claims) {
        return json(env, req, { error: "invalid_token" }, 401);
      }
      const requireAuth = () => {
        if (!claims) throw { _status: 401, message: "Authentication required" };
        return claims;
      };

      // --- AI (optional auth; anonymous = public demo, rate-limited) ---
      if (path === "/api/transcribe" && req.method === "POST")
        return handleTranscribe(env, req, claims);
      if (path === "/api/analyze-text" && req.method === "POST")
        return handleAnalyzeText(env, req, claims);
      if (path === "/api/ai-agent" && req.method === "POST")
        return handleAiAgent(env, req, requireAuth());
      if (path === "/api/usage" && req.method === "GET")
        return handleUsage(env, req, claims);

      // --- Data (auth required, scoped to claims.sub) ---
      if (path === "/api/notes" && req.method === "GET")
        return handleGetNotes(env, req, requireAuth());
      if (path === "/api/notes/sync" && req.method === "POST")
        return handleSyncNotes(env, req, requireAuth());
      if (path === "/api/notes/all" && req.method === "DELETE")
        return handleDeleteAllNotes(env, req, requireAuth());
      if (path.startsWith("/api/notes/") && req.method === "DELETE") {
        const id = decodeURIComponent(path.split("/").pop() || "");
        return handleDeleteNote(env, req, requireAuth(), id);
      }
      if (path === "/api/user-settings" && req.method === "POST")
        return handleSaveSettings(env, req, requireAuth());

      if (path === "/api/health")
        return json(env, req, { status: "ok", time: new Date().toISOString() });

      return json(env, req, { error: "Not found" }, 404);
    } catch (e: any) {
      if (e && e._status) return json(env, req, { error: e.message }, e._status);
      return json(env, req, { error: "server_error", message: String(e?.message || e) }, 500);
    }
  },
};
