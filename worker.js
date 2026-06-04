/**
 * NoteWave API — single Cloudflare Worker for napi.ccma-fetch.space
 * One worker handles ALL paths (routed internally by url.pathname).
 *
 * Verifies the Auth0 access token (RS256), proxies AI to Gemini with a
 * server-side key, and proxies data to Supabase (service role) scoped to the
 * authenticated user (identity = verified token sub, never a client uid).
 *
 * NOTE: The anonymous free demo is DISABLED. /api/transcribe and
 * /api/analyze-text now require a valid Auth0 token; requests without one get
 * 401 { "error": "Authentication required" }.
 *
 * Dashboard setup:
 *   Settings -> Variables and Secrets:
 *     Plaintext vars: AUTH0_DOMAIN, AUTH0_AUDIENCE, ALLOWED_ORIGIN,
 *                     GEMINI_MODEL, SUPABASE_URL
 *     Secrets:        GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 *                     OPENAI_API_KEY (optional — fallback when Gemini is overloaded)
 *   (Optional) KV binding named RATE_LIMIT for real rate limiting.
 *   (Optional) R2 bucket binding named AUDIO for voice-memo storage.
 *   Settings -> Domains & Routes: add custom domain napi.ccma-fetch.space
 */

// ---------- CORS ----------
function corsHeaders(env, req) {
  const origin = req.headers.get("Origin") || "";
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
function json(env, req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env, req) },
  });
}

// ---------- Auth0 JWT verify (Web Crypto + cached JWKS) ----------
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  s += "=".repeat(pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}
let jwksCache = null;
async function loadJwks(env, force = false) {
  const now = Date.now();
  if (!force && jwksCache && now - jwksCache.at < 3600000) return jwksCache.keys;
  const res = await fetch(`https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`);
  if (!res.ok) throw new Error("Failed to fetch JWKS");
  const data = await res.json();
  jwksCache = { keys: data.keys, at: now };
  return data.keys;
}
function importKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}
async function verifyAuth0Token(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header, payload;
  try {
    header = decodePart(h);
    payload = decodePart(p);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

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
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) return null;

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
function bearer(req) {
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// ---------- Rate limiting (optional KV) ----------
const FREE_DAILY = 3;
const PREMIUM_DAILY = 50;

// Combined stored-note cap (voice notes + uploads together). Also keeps the AI
// agent prompt bounded, since the agent is fed every note.
const FREE_NOTES = 10;
const PREMIUM_NOTES = 100;
function noteLimit(plan) {
  return plan === "premium" ? PREMIUM_NOTES : FREE_NOTES;
}

// Per-user audio storage cap in R2. Backstop against R2 abuse; the frontend
// enforces the real combined storage quota (voice + uploads + notes together).
const FREE_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB
const PREMIUM_AUDIO_BYTES = 1024 * 1024 * 1024; // 1 GB
function audioLimit(plan) {
  return plan === "premium" ? PREMIUM_AUDIO_BYTES : FREE_AUDIO_BYTES;
}
// Total bytes a user already holds in R2, summed across the (paginated) object
// listing under their prefix.
async function r2UsedBytes(env, prefix) {
  let total = 0;
  let cursor;
  do {
    const res = await env.AUDIO.list({ prefix, cursor, limit: 1000 });
    for (const o of res.objects) total += o.size || 0;
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);
  return total;
}

// Per-calendar-day (UTC) counter key, so usage resets at 00:00 UTC instead of
// rolling 24h from the last request.
function rateKey(sub) {
  return `ai:${sub}:${new Date().toISOString().slice(0, 10)}`;
}
// Seconds until the next UTC midnight (floored at KV's 60s minimum). Always
// targets the same wall-clock midnight, so re-putting never extends the window.
function secondsUntilUtcReset() {
  const now = Date.now();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((midnight.getTime() - now) / 1000));
}
function hoursUntilUtcReset() {
  return Math.ceil(secondsUntilUtcReset() / 3600);
}

async function checkRateLimit(env, key, limit) {
  if (!env.RATE_LIMIT) return { allowed: true, remaining: limit };
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit) return { allowed: false, remaining: 0 };
  await env.RATE_LIMIT.put(key, String(count + 1), {
    expirationTtl: secondsUntilUtcReset(),
  });
  return { allowed: true, remaining: limit - (count + 1) };
}
// Give back a unit when a request never reached a working model (all providers
// unavailable), so an outage doesn't eat the user's daily allowance.
async function refundRateLimit(env, key) {
  if (!env.RATE_LIMIT) return;
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count <= 0) return;
  await env.RATE_LIMIT.put(key, String(count - 1), {
    expirationTtl: secondsUntilUtcReset(),
  });
}

async function getPlan(env, sub) {
  try {
    const res = await sb(env, `users?auth0_id=eq.${encodeURIComponent(sub)}&select=plan`);
    const rows = await res.json();
    return rows?.[0]?.plan === "premium" ? "premium" : "free";
  } catch {
    return "free";
  }
}

function planLimit(plan) {
  return plan === "premium" ? PREMIUM_DAILY : FREE_DAILY;
}

// ---------- Gemini ----------
function geminiModel(env) {
  return env.GEMINI_MODEL || "gemini-3.5-flash";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Transient server-side statuses worth retrying; 503 is Gemini's "model
// overloaded". 429 (quota) and 4xx (bad request) are NOT retried.
const GEMINI_RETRYABLE = new Set([500, 502, 503, 504]);
async function geminiGenerate(env, parts, jsonMode, { retries = 2, baseDelayMs = 600 } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel(
    env
  )}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = { contents: [{ parts }] };
  if (jsonMode)
    body.generationConfig = { responseMimeType: "application/json" };

  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return (
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || ""
      );
    }
    lastStatus = res.status;
    lastText = await res.text();
    if (!GEMINI_RETRYABLE.has(res.status)) break; // non-transient, stop early
    if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt); // backoff
  }
  // Tag transient/overload failures so callers can fall back to OpenAI.
  const err = new Error(`Gemini ${lastStatus}: ${lastText.slice(0, 300)}`);
  if (GEMINI_RETRYABLE.has(lastStatus)) err.overloaded = true;
  throw err;
}

// ---------- OpenAI fallback (used only when Gemini is overloaded) ----------
const canFallback = (env, e) => !!(e && e.overloaded && env.OPENAI_API_KEY);
// Build an OpenAI error, tagging 5xx as overloaded so a both-providers-down
// situation surfaces to the client as "models unavailable".
function openaiError(status, text) {
  const err = new Error(`OpenAI ${status}: ${String(text).slice(0, 300)}`);
  if (status >= 500) err.overloaded = true;
  return err;
}
// Single-prompt text generation via gpt-4o-mini. jsonMode uses response_format;
// the structured prompt already contains the word "JSON" as OpenAI requires.
async function openaiText(env, prompt, jsonMode) {
  const body = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw openaiError(res.status, await res.text());
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}
// Speech-to-text via gpt-4o-mini-transcribe (accepts webm/ogg, unlike the chat
// audio API). Returns the raw transcript text.
async function openaiTranscribe(env, base64, mime) {
  const bytes = b64urlToBytes(base64);
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `audio.${ext}`);
  form.append("model", "gpt-4o-mini-transcribe");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw openaiError(res.status, await res.text());
  const data = await res.json();
  return data?.text || "";
}

function structuredPrompt(sourceClause) {
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
  "scheduledDate": "(any specified day/time like 'Monday 9 AM'; else '')",
  "projectStartDate": "(any specified start time; else '')",
  "isComplex": (true if a complex app/tool/software project needing modular work, else false),
  "subTodos": [ { "id": "sub_1", "text": "Detailed micro-task", "completed": false } ],
  "tags": "(2-3 comma-separated relevant tags)"
}
If the input is purely factual with zero actionable steps, set "subTodos" to []. If "isComplex" is true, produce 5-8 structured sub-todos outlining how to build it.`;
}
function safeParse(text, fallbackTranscript) {
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
function normalizeSubTodos(parsed) {
  if (Array.isArray(parsed.subTodos)) {
    parsed.subTodos = parsed.subTodos.map((t, i) => ({
      id: t.id || `sub_${Date.now()}_${i}`,
      text: t.text || "Action point",
      completed: !!t.completed,
    }));
  } else parsed.subTodos = [];
  return parsed;
}

// ---------- Supabase ----------
function sb(env, path, init = {}) {
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
async function resolveUserId(env, sub, email) {
  const sel = await sb(
    env,
    `users?auth0_id=eq.${encodeURIComponent(sub)}&select=id`
  );
  const rows = await sel.json();
  if (Array.isArray(rows) && rows.length) return rows[0].id;
  const ins = await sb(env, "users", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ auth0_id: sub, email: email || null, plan: "free" }),
  });
  const created = await ins.json();
  const id = created?.[0]?.id;
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
function noteToDb(n, userId) {
  return {
    id: n.id,
    user_id: userId,
    title: n.title || "",
    transcript: n.transcript || "",
    idea_summary: n.ideaSummary || "",
    action_items: n.actionItems || "",
    category: n.category || "ideas",
    idea_name: n.ideaName || "",
    scheduled_date: n.scheduledDate || "",
    project_start_date: n.projectStartDate || "",
    is_complex: !!n.isComplex,
    sub_todos: n.subTodos || [],
    tags: n.tags || [],
    model_used: n.modelUsed || "gemini",
    duration: Math.round(Number(n.duration || 0)),
    audio_key: n.audioKey || null,
    audio_bytes: Math.round(Number(n.audioBytes || 0)),
    created_at: n.createdAt || new Date().toISOString(),
  };
}
function noteToClient(r) {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    transcript: r.transcript,
    ideaSummary: r.idea_summary,
    actionItems: r.action_items,
    category: r.category,
    ideaName: r.idea_name,
    scheduledDate: r.scheduled_date,
    projectStartDate: r.project_start_date,
    isComplex: r.is_complex,
    subTodos: r.sub_todos || [],
    tags: r.tags || [],
    modelUsed: r.model_used,
    duration: r.duration || 0,
    audioKey: r.audio_key || null,
    audioBytes: r.audio_bytes || 0,
    createdAt: r.created_at,
  };
}

// ---------- Handlers ----------
async function handleTranscribe(env, req, claims) {
  const b = await req.json().catch(() => ({}));
  if (!b.audio) return json(env, req, { error: "Missing audio" }, 400);
  const plan = await getPlan(env, claims.sub);
  const rl = await checkRateLimit(env, rateKey(claims.sub), planLimit(plan));
  if (!rl.allowed)
    return json(
      env,
      req,
      { error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." },
      429
    );
  const base64 = b.audio.includes(";base64,")
    ? b.audio.split(";base64,")[1]
    : b.audio;
  const mime = b.audio.match(/data:([^;]+);/)?.[1] || "audio/webm";
  // Enforce the per-user audio storage cap up front so we don't spend an AI
  // call on a recording we'd then refuse to store. base64 inflates ~4/3, so the
  // decoded size is ~75% of the string length.
  if (env.AUDIO) {
    const incoming = Math.floor(base64.length * 0.75);
    const cap = audioLimit(plan);
    const used = await r2UsedBytes(env, `${claims.sub}/`);
    if (used + incoming > cap)
      return json(
        env,
        req,
        {
          error: "STORAGE_LIMIT_EXCEEDED",
          message: `Audio storage full (${Math.round(cap / 1024 / 1024)} MB limit on the ${plan} plan).`,
          limit: cap,
        },
        413
      );
  }
  try {
    let out;
    let usedModel = geminiModel(env);
    try {
      out = await geminiGenerate(
        env,
        [
          { inlineData: { data: base64, mimeType: mime } },
          { text: structuredPrompt("Analyze this audio note and transcribe it.") },
        ],
        true
      );
    } catch (e) {
      if (!canFallback(env, e)) throw e;
      // Gemini overloaded → transcribe with OpenAI, then structure the text.
      const transcript = await openaiTranscribe(env, base64, mime);
      out = await openaiText(
        env,
        `${structuredPrompt("Analyze the following transcribed voice note:")}\n\nINPUT TEXT:\n"""\n${transcript}\n"""`,
        true
      );
      usedModel = "gpt-4o-mini";
    }
    // Persist the source audio to R2 object storage (free egress) so it can be
    // played back across devices. Keyed by the verified token sub so ownership
    // is checkable on playback without a DB lookup. Best-effort: a storage
    // failure must never block returning the transcription.
    let audioKey = null;
    let audioBytes = 0;
    if (env.AUDIO) {
      try {
        const bytes = b64urlToBytes(base64);
        const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
        audioKey = `${claims.sub}/${crypto.randomUUID()}.${ext}`;
        await env.AUDIO.put(audioKey, bytes, {
          httpMetadata: { contentType: mime },
        });
        audioBytes = bytes.length;
      } catch {
        audioKey = null;
        audioBytes = 0;
      }
    }
    return json(env, req, {
      success: true,
      data: normalizeSubTodos(safeParse(out, "")),
      model: usedModel,
      audioKey,
      audioBytes,
    });
  } catch (e) {
    // All providers unavailable (Gemini overloaded + OpenAI missing or also
    // down): refund the request so an outage doesn't cost the user a unit of
    // their daily allowance, and tell them to retry shortly.
    if (e && e.overloaded) {
      await refundRateLimit(env, rateKey(claims.sub));
      return json(
        env,
        req,
        {
          error: "MODEL_UNAVAILABLE",
          message: "AI models are busy right now. Please wait a few seconds and try again.",
        },
        503
      );
    }
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
}
async function handleAnalyzeText(env, req, claims) {
  const b = await req.json().catch(() => ({}));
  if (!b.text) return json(env, req, { error: "Missing text" }, 400);
  const plan = await getPlan(env, claims.sub);
  const rl = await checkRateLimit(env, rateKey(claims.sub), planLimit(plan));
  if (!rl.allowed)
    return json(
      env,
      req,
      { error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." },
      429
    );
  const analyzePrompt = `${structuredPrompt(
    "Analyze the following note text:"
  )}\n\nINPUT TEXT:\n"""\n${b.text}\n"""`;
  try {
    let out;
    let usedModel = geminiModel(env);
    try {
      out = await geminiGenerate(env, [{ text: analyzePrompt }], true);
    } catch (e) {
      if (!canFallback(env, e)) throw e;
      out = await openaiText(env, analyzePrompt, true);
      usedModel = "gpt-4o-mini";
    }
    const parsed = normalizeSubTodos(safeParse(out, b.text));
    if (!parsed.transcript) parsed.transcript = b.text;
    return json(env, req, {
      success: true,
      data: parsed,
      model: usedModel,
    });
  } catch (e) {
    // All providers unavailable (Gemini overloaded + OpenAI missing or also
    // down): refund the request so an outage doesn't cost the user a unit of
    // their daily allowance, and tell them to retry shortly.
    if (e && e.overloaded) {
      await refundRateLimit(env, rateKey(claims.sub));
      return json(
        env,
        req,
        {
          error: "MODEL_UNAVAILABLE",
          message: "AI models are busy right now. Please wait a few seconds and try again.",
        },
        503
      );
    }
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
}
async function handleAiAgent(env, req, claims) {
  const b = await req.json().catch(() => ({}));
  const messages = Array.isArray(b.messages) ? b.messages : [];
  const notes = Array.isArray(b.notes) ? b.notes : [];
  const plan = await getPlan(env, claims.sub);
  const rl = await checkRateLimit(env, rateKey(claims.sub), planLimit(plan));
  if (!rl.allowed)
    return json(
      env,
      req,
      { error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." },
      429
    );
  const context = notes
    .map(
      (n, i) =>
        `Note ${i + 1} [${n.category || "ideas"}]: ${n.title || ""}\nSummary: ${
          n.ideaSummary || ""
        }\nTasks: ${(n.subTodos || []).map((t) => t.text).join("; ")}`
    )
    .join("\n\n");
  const convo = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  const prompt = `You are NoteWave's helpful assistant. Answer using the user's notes as context when relevant. Reply in the user's language. Use concise markdown.\n\nUSER NOTES:\n${
    context || "(no notes yet)"
  }\n\nCONVERSATION:\n${convo}\n\nAssistant:`;
  try {
    let reply;
    try {
      reply = await geminiGenerate(env, [{ text: prompt }], false);
    } catch (e) {
      if (!canFallback(env, e)) throw e;
      reply = await openaiText(env, prompt, false);
    }
    return json(env, req, { success: true, reply });
  } catch (e) {
    // All providers unavailable (Gemini overloaded + OpenAI missing or also
    // down): refund the request so an outage doesn't cost the user a unit of
    // their daily allowance, and tell them to retry shortly.
    if (e && e.overloaded) {
      await refundRateLimit(env, rateKey(claims.sub));
      return json(
        env,
        req,
        {
          error: "MODEL_UNAVAILABLE",
          message: "AI models are busy right now. Please wait a few seconds and try again.",
        },
        503
      );
    }
    return json(env, req, { error: "AI_ERROR", message: e.message }, 502);
  }
}
async function handleGetNotes(env, req, claims) {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  const res = await sb(
    env,
    `notes?user_id=eq.${userId}&select=*&order=created_at.desc`
  );
  const rows = await res.json();
  return json(env, req, {
    success: true,
    notes: (rows || []).map(noteToClient),
  });
}
async function handleSyncNotes(env, req, claims) {
  const b = await req.json().catch(() => ({}));
  const notes = Array.isArray(b.notes) ? b.notes : [];
  const userId = await resolveUserId(env, claims.sub, claims.email);
  const rows = notes.map((n) => noteToDb(n, userId));
  if (rows.length) {
    // Enforce the combined note cap on the post-merge total (existing rows
    // unioned with incoming ids), so it holds even against direct API calls.
    const plan = await getPlan(env, claims.sub);
    const limit = noteLimit(plan);
    const existing = await sb(env, `notes?user_id=eq.${userId}&select=id`);
    const ids = new Set(((await existing.json().catch(() => [])) || []).map((r) => r.id));
    for (const r of rows) ids.add(r.id);
    if (ids.size > limit)
      return json(
        env,
        req,
        {
          error: "NOTE_LIMIT_REACHED",
          message: `Note limit reached (${limit} max on the ${plan} plan).`,
          limit,
        },
        403
      );
    await sb(env, "notes?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }
  return json(env, req, { success: true });
}
async function handleDeleteNote(env, req, claims, id) {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  // Remove the backing audio object first so deletes don't orphan R2 blobs.
  if (env.AUDIO) {
    try {
      const sel = await sb(
        env,
        `notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}&select=audio_key`
      );
      const key = ((await sel.json()) || [])[0]?.audio_key;
      if (key) await env.AUDIO.delete(key);
    } catch {}
  }
  await sb(
    env,
    `notes?id=eq.${encodeURIComponent(id)}&user_id=eq.${userId}`,
    { method: "DELETE" }
  );
  return json(env, req, { success: true });
}
async function handleDeleteAllNotes(env, req, claims) {
  const userId = await resolveUserId(env, claims.sub, claims.email);
  // Purge every audio object under this user's prefix.
  if (env.AUDIO) {
    try {
      const listed = await env.AUDIO.list({ prefix: `${claims.sub}/` });
      if (listed?.objects?.length)
        await Promise.all(listed.objects.map((o) => env.AUDIO.delete(o.key)));
    } catch {}
  }
  await sb(env, `notes?user_id=eq.${userId}`, { method: "DELETE" });
  return json(env, req, { success: true });
}
async function handleGetAudio(env, req, claims) {
  const key = new URL(req.url).searchParams.get("key") || "";
  // Keys are prefixed with the owner's verified token sub — enforce ownership.
  if (!key || !key.startsWith(`${claims.sub}/`))
    return json(env, req, { error: "forbidden" }, 403);
  if (!env.AUDIO) return json(env, req, { error: "storage_unavailable" }, 503);
  const obj = await env.AUDIO.get(key);
  if (!obj) return json(env, req, { error: "not_found" }, 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "audio/webm",
      "Cache-Control": "private, max-age=3600",
      ...corsHeaders(env, req),
    },
  });
}
async function handleSaveSettings(env, req, claims) {
  const b = await req.json().catch(() => ({}));
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
  if (b.tier)
    await sb(env, `users?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ plan: b.tier, updated_at: new Date().toISOString() }),
    });
  return json(env, req, { success: true });
}
async function handleUsage(env, req, claims) {
  const plan = claims?.sub ? await getPlan(env, claims.sub) : "free";
  const limit = planLimit(plan);
  let remaining = limit;
  if (env.RATE_LIMIT && claims?.sub) {
    const raw = await env.RATE_LIMIT.get(rateKey(claims.sub));
    remaining = Math.max(0, limit - (raw ? parseInt(raw, 10) || 0 : 0));
  }
  return json(env, req, { limit, remaining, resetInHours: hoursUntilUtcReset() });
}

// ---------- Router (single entry point) ----------
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    const path = new URL(req.url).pathname;
    try {
      const token = bearer(req);
      const claims = token ? await verifyAuth0Token(token, env) : null;
      if (token && !claims) return json(env, req, { error: "invalid_token" }, 401);
      const requireAuth = () => {
        if (!claims) throw { _status: 401, message: "Authentication required" };
        return claims;
      };

      // AI endpoints now require auth (free demo disabled)
      if (path === "/api/transcribe" && req.method === "POST")
        return handleTranscribe(env, req, requireAuth());
      if (path === "/api/analyze-text" && req.method === "POST")
        return handleAnalyzeText(env, req, requireAuth());
      if (path === "/api/ai-agent" && req.method === "POST")
        return handleAiAgent(env, req, requireAuth());
      if (path === "/api/usage" && req.method === "GET")
        return handleUsage(env, req, claims);
      if (path === "/api/audio" && req.method === "GET")
        return handleGetAudio(env, req, requireAuth());
      if (path === "/api/notes" && req.method === "GET")
        return handleGetNotes(env, req, requireAuth());
      if (path === "/api/notes/sync" && req.method === "POST")
        return handleSyncNotes(env, req, requireAuth());
      if (path === "/api/notes/all" && req.method === "DELETE")
        return handleDeleteAllNotes(env, req, requireAuth());
      if (path.startsWith("/api/notes/") && req.method === "DELETE")
        return handleDeleteNote(
          env,
          req,
          requireAuth(),
          decodeURIComponent(path.split("/").pop() || "")
        );
      if (path === "/api/user-settings" && req.method === "POST")
        return handleSaveSettings(env, req, requireAuth());
      if (path === "/api/health")
        return json(env, req, { status: "ok", time: new Date().toISOString() });

      return json(env, req, { error: "Not found" }, 404);
    } catch (e) {
      if (e && e._status) return json(env, req, { error: e.message }, e._status);
      return json(
        env,
        req,
        { error: "server_error", message: String(e?.message || e) },
        500
      );
    }
  },
};
