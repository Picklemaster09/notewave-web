import express from "express";
import { handleAuthError } from "./server/middleware/auth.js";
import { getGeminiClient, FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, LANG_NAMES } from "./server/lib/gemini.js";
import {
  getUserByAuth0Id,
  getSettings,
  recordUsageEvent,
  getUsageCount,
} from "./server/lib/supabase.js";
import { requireAuth, getAuth0UserId } from "./server/middleware/auth.js";
import usersRouter from "./server/routes/users.js";
import notesRouter from "./server/routes/notes.js";
import settingsRouter from "./server/routes/settings.js";

export const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS — allow requests from frontend origin in development and production
const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:5173",
  "http://localhost:3000",
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Public routes ─────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Authenticated resource routes ─────────────────────────────────────────────

app.use("/api/users", usersRouter);
app.use("/api/notes", notesRouter);
app.use("/api/settings", settingsRouter);

// ── AI endpoints (protected) ─────────────────────────────────────────────────

// Resolve per-user plan and custom API key from Supabase.
// Falls back to IP-based rate limiting if the user record isn't found.
async function resolveUserContext(req: express.Request) {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return { userId: null, isPro: false, customApiKey: undefined };

    const settings = await getSettings(user.id);
    return {
      userId: user.id,
      isPro: user.plan === "premium",
      customApiKey: settings?.custom_api_key ?? undefined,
    };
  } catch {
    return { userId: null, isPro: false, customApiKey: undefined };
  }
}

// In-memory fallback rate limit (used when user is not authenticated)
interface RateLimit { count: number; resetAt: number }
const anonRateLimitStore = new Map<string, RateLimit>();

function getClientIp(req: express.Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0])?.trim()
    ?? req.socket.remoteAddress
    ?? "anon";
}

function checkAnonRateLimit(req: express.Request, limit = FREE_DAILY_LIMIT) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  let status = anonRateLimitStore.get(ip);
  if (!status || now > status.resetAt) {
    status = { count: 0, resetAt: now + windowMs };
  }
  if (status.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: status.resetAt };
  }
  status.count += 1;
  anonRateLimitStore.set(ip, status);
  return { allowed: true, remaining: limit - status.count, resetTime: status.resetAt };
}

// GET /api/usage — usage quota info for authenticated user
app.get("/api/usage", requireAuth, async (req, res) => {
  try {
    const { userId, isPro } = await resolveUserContext(req);
    const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

    if (!userId) {
      return res.json({ limit, remaining: limit, resetInHours: 24 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const used = await getUsageCount(userId, "transcription", since);
    const remaining = Math.max(0, limit - used);
    res.json({ limit, remaining, resetInHours: 24 });
  } catch (err: any) {
    res.status(500).json({ error: "USAGE_FAILED", message: err.message });
  }
});

// POST /api/transcribe — audio transcription via Gemini
app.post("/api/transcribe", requireAuth, async (req, res) => {
  try {
    const { audio, language } = req.body;
    if (!audio) return res.status(400).json({ error: "Missing audio data" });

    const { userId, isPro, customApiKey } = await resolveUserContext(req);
    const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const targetLanguage = LANG_NAMES[language] || language || "Auto-Detect";

    // Per-user DB rate limit when authenticated, IP-based fallback otherwise
    if (userId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const used = await getUsageCount(userId, "transcription", since);
      if (used >= limit) {
        return res.status(429).json({
          error: "RATE_LIMIT_EXCEEDED",
          message: isPro
            ? `Pro plan daily limit reached (${limit}/day).`
            : `Free plan limit reached (${limit}/day). Upgrade to Pro for more.`,
        });
      }
    } else {
      const check = checkAnonRateLimit(req);
      if (!check.allowed) {
        return res.status(429).json({ error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." });
      }
    }

    let ai;
    try {
      ai = getGeminiClient(customApiKey);
    } catch {
      return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Gemini API key missing or invalid." });
    }

    const base64Data = audio.includes(";base64,") ? audio.split(";base64,")[1] : audio;
    const mimeType = audio.match(/data:([^;]+);/)?.[1] || "audio/webm";

    const audioPart = { inlineData: { data: base64Data, mimeType } };

    const promptText = buildTranscriptionPrompt(targetLanguage);

    let parsedResult: any;

    if (isPro) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [audioPart, { text: promptText }] },
        config: { responseMimeType: "application/json" },
      });
      parsedResult = safeParseJson(response.text ?? "{}");
    } else {
      // Two-phase: high-quality audio→text, then cheap text→JSON
      const transcriptResp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [audioPart, { text: "Transcribe this audio verbatim in the spoken language. Return only the transcript text." }] },
      });
      const rawTranscript = (transcriptResp.text ?? "No clear spoken words detected").trim();

      const structureResp = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: buildStructurePrompt(rawTranscript),
        config: { responseMimeType: "application/json" },
      });
      parsedResult = safeParseJson(structureResp.text ?? "{}");
      parsedResult.transcript = rawTranscript;
    }

    parsedResult.subTodos = normalizeSubTodos(parsedResult.subTodos);

    if (userId) await recordUsageEvent(userId, "transcription");

    res.json({
      success: true,
      model: isPro ? "gemini-2.5-flash" : "gemini-2.0-flash-lite",
      tier: isPro ? "premium" : "free",
      data: parsedResult,
    });
  } catch (err: any) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "TRANSCRIPTION_FAILED", message: err.message });
  }
});

// POST /api/analyze-text — text analysis via Gemini
app.post("/api/analyze-text", requireAuth, async (req, res) => {
  try {
    const { text, filename } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Missing text" });

    const { userId, isPro, customApiKey } = await resolveUserContext(req);
    const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

    if (userId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const used = await getUsageCount(userId, "transcription", since);
      if (used >= limit) {
        return res.status(429).json({ error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." });
      }
    } else {
      const check = checkAnonRateLimit(req);
      if (!check.allowed) {
        return res.status(429).json({ error: "RATE_LIMIT_EXCEEDED", message: "Daily limit reached." });
      }
    }

    let ai;
    try {
      ai = getGeminiClient(customApiKey);
    } catch {
      return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Gemini API key missing or invalid." });
    }

    const modelToUse = isPro ? "gemini-2.5-flash" : "gemini-2.0-flash-lite";
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: buildTextAnalysisPrompt(text, filename),
      config: { responseMimeType: "application/json" },
    });

    const parsedResult = safeParseJson(response.text ?? "{}");
    parsedResult.subTodos = normalizeSubTodos(parsedResult.subTodos);

    if (userId) await recordUsageEvent(userId, "transcription");

    res.json({ success: true, model: modelToUse, tier: isPro ? "premium" : "free", data: parsedResult });
  } catch (err: any) {
    console.error("Text analysis error:", err);
    res.status(500).json({ error: "ANALYSIS_FAILED", message: err.message });
  }
});

// Auth error handler — must be registered after all routes
app.use(handleAuthError);

// ── Prompt helpers ────────────────────────────────────────────────────────────

function buildTranscriptionPrompt(targetLanguage?: string) {
  const langHint = targetLanguage ? ` Prefer ${targetLanguage} if ambiguous.` : "";
  return `Analyze this audio note. Output must be in the language spoken in the recording.${langHint}
Return ONLY a valid JSON object (no markdown blocks):
{
  "transcript": "verbatim transcript",
  "headlineTitle": "concise 5-6 word title",
  "summaryText": "2-3 sentence summary",
  "actionItems": "- [ ] task1\\n- [ ] task2",
  "category": "ideas or reminders",
  "ideaName": "Idea or Note",
  "scheduledDate": "",
  "projectStartDate": "",
  "isComplex": false,
  "subTodos": [{"id":"sub_1","text":"task","completed":false}],
  "tags": "tag1, tag2"
}`;
}

function buildStructurePrompt(transcript: string) {
  return `Analyze this transcript and return ONLY a valid JSON object:
Transcript: """${transcript.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"""
{
  "transcript": "${transcript.replace(/"/g, '\\"').replace(/\n/g, "\\n")}",
  "headlineTitle": "concise title",
  "summaryText": "2-3 sentence summary",
  "actionItems": "- [ ] task",
  "category": "ideas or reminders",
  "ideaName": "Idea or Note",
  "scheduledDate": "",
  "projectStartDate": "",
  "isComplex": false,
  "subTodos": [],
  "tags": "tag1, tag2"
}`;
}

function buildTextAnalysisPrompt(text: string, filename?: string) {
  return `Analyze this text document (filename: "${filename ?? "unnamed"}").
Return ONLY a valid JSON object:
{
  "transcript": "clean formatted text",
  "headlineTitle": "concise title",
  "summaryText": "2-3 sentence summary",
  "actionItems": "- [ ] task",
  "category": "ideas or reminders",
  "ideaName": "Idea or Note",
  "scheduledDate": "",
  "projectStartDate": "",
  "isComplex": false,
  "subTodos": [],
  "tags": "tag1, tag2"
}
Input text:
"""
${text}
"""`;
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {
      transcript: text,
      headlineTitle: "Voice Note",
      summaryText: "Transcription complete.",
      actionItems: "- [ ] Review note",
      category: "ideas",
      ideaName: "Note",
      scheduledDate: "",
      projectStartDate: "",
      isComplex: false,
      subTodos: [],
      tags: "audio, voice",
    };
  }
}

function normalizeSubTodos(raw: any[]): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t, i) => ({
    id: t.id || `sub_${Date.now()}_${i}`,
    text: t.text || "Action point",
    completed: !!t.completed,
  }));
}
