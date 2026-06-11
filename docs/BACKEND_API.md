# NoteWave Backend API Documentation

## Overview

NoteWave backend is a **single Cloudflare Worker** deployed at `https://napi.ccma-fetch.space`. It handles all API routing, authentication, AI processing, and data persistence in one edge-compute file ([`worker.js`](worker.js)).

### Architecture Diagram

```mersequence
title NoteWave Request Flow
User Mobile App->>Auth0: Login (PKCE OAuth2)
Auth0->>User Mobile App: Access Token (JWT RS256)
User Mobile App->>Cloudflare Worker: API Request + Bearer Token
Cloudflare Worker->>Cloudflare Worker: Verify JWT against Auth0 JWKS
Cloudflare Worker->>Gemini/OpenAI: AI Processing (transcription/analysis)
Gemini/OpenAI->>Cloudflare Worker: AI Response
Cloudflare Worker->>Supabase: CRUD Operations (service role)
Supabase->>Cloudflare Worker: Data Response
Cloudflare Worker->>User Mobile App: JSON Response
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Edge Runtime | Cloudflare Workers | Single API endpoint, global edge deployment |
| Authentication | Auth0 (RS256 JWT) | User identity verification, PKCE flow for mobile |
| AI - Primary | Google Gemini (gemini-3.5-flash) | Voice transcription, text analysis, RAG agent |
| AI - Fallback | OpenAI (gpt-4o-mini) | Automatic fallback when Gemini is overloaded |
| Database | Supabase (PostgreSQL) | User profiles, notes, settings persistence |
| Object Storage | Cloudflare R2 | Audio file storage (voice recordings) |
| Rate Limiting | Cloudflare KV | Per-user daily AI request counters |

## Environment Variables (Cloudflare Dashboard)

### Plaintext Variables
| Variable | Example | Description |
|----------|---------|-------------|
| `AUTH0_DOMAIN` | `notewave.eu.auth0.com` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | `https://notewave-api` | API identifier for JWT audience validation |
| `ALLOWED_ORIGIN` | `https://notewave.ccma-fetch.space` | CORS allowed origin |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Gemini model slug |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |

### Secrets
| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key (optional fallback) |

### Bindings
| Binding | Type | Name | Purpose |
|---------|------|------|---------|
| RATE_LIMIT | KV Namespace | `RATE_LIMIT` | Per-user daily rate limiting |
| AUDIO | R2 Bucket | `AUDIO` | Voice recording object storage |

---

## API Endpoints

**Base URL:** `https://napi.ccma-fetch.space`

All endpoints except `/api/health` and `/api/usage` require a valid Auth0 access token in the `Authorization: Bearer <token>` header.

### 1. Health Check

```
GET /api/health
```

**Auth:** Not required

**Response:**
```json
{ "status": "ok", "time": "2026-06-11T18:00:00.000Z" }
```

### 2. Transcribe Voice Recording

```
POST /api/transcribe
```

**Auth:** Required

**Request Body:**
```json
{
  "audio": "data:audio/webm;base64,UklGR...",
  "tier": "free",
  "customApiKey": "optional-gemini-key",
  "language": "en",
  "generateTodos": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "Full transcript text...",
    "headlineTitle": "Concise 5-6 word title",
    "summaryText": "2-3 sentence overview",
    "actionItems": " - [ ] Task 1\n - [ ] Task 2",
    "category": "ideas",
    "ideaName": "Idea",
    "scheduledDate": "",
    "projectStartDate": "",
    "isComplex": false,
    "subTodos": [{"id": "sub_1", "text": "Micro-task", "completed": false}],
    "tags": ["voice", "idea"]
  },
  "model": "gemini-3.5-flash",
  "audioKey": "user_sub/random-id.webm",
  "audioBytes": 12345
}
```

### 3. Analyze Text Document

```
POST /api/analyze-text
```

**Auth:** Required

**Request Body:**
```json
{
  "text": "The text content to analyze...",
  "tier": "free",
  "customApiKey": "optional-gemini-key",
  "filename": "document.txt",
  "language": "en",
  "generateTodos": true
}
```

**Response:** Same structure as `/api/transcribe` (without `audioKey`/`audioBytes`).

### 4. AI Agent Chat (RAG)

```
POST /api/ai-agent
```

**Auth:** Required

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "What tasks do I have?"},
    {"role": "model", "content": "You have 3 tasks..."}
  ],
  "notes": [
    {"id": "1", "title": "My Note", "category": "ideas", "ideaSummary": "...", "subTodos": []}
  ]
}
```

**Response:**
```json
{ "success": true, "reply": "Based on your notes..." }
```

### 5. Get User Notes

```
GET /api/notes
```

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "notes": [
    {
      "id": "note_123",
      "userId": "user-uuid",
      "title": "My Voice Note",
      "transcript": "Full transcript...",
      "ideaSummary": "Summary text",
      "actionItems": " - [ ] Do something",
      "category": "ideas",
      "ideaName": "Idea",
      "scheduledDate": "",
      "projectStartDate": "",
      "isComplex": false,
      "subTodos": [],
      "tags": ["voice"],
      "modelUsed": "gemini-3.5-flash",
      "duration": 45,
      "audioKey": "user_sub/file.webm",
      "audioBytes": 12345,
      "createdAt": "2026-06-11T18:00:00.000Z"
    }
  ]
}
```

### 6. Sync Notes (Upsert)

```
POST /api/notes/sync
```

**Auth:** Required

**Request Body:**
```json
{
  "notes": [
    {"id": "note_1", "title": "...", "transcript": "...", ...}
  ]
}
```

**Response:** `{ "success": true }`

### 7. Delete Single Note

```
DELETE /api/notes/{noteId}
```

**Auth:** Required

**Response:** `{ "success": true }`

### 8. Delete All Notes

```
DELETE /api/notes/all
```

**Auth:** Required

**Response:** `{ "success": true }`

### 9. Get Audio File

```
GET /api/audio?key={audioKey}
```

**Auth:** Required (ownership verified - key must start with user's token sub)

**Response:** Raw audio stream (webm/ogg/m4a)

### 10. Save User Settings

```
POST /api/user-settings
```

**Auth:** Required

**Request Body:**
```json
{
  "uid": "user-id",
  "customApiKey": "",
  "tier": "free",
  "language": "en",
  "theme": "light",
  "accentColor": "blue",
  "actionButtonAction": "record"
}
```

**Response:** `{ "success": true }`

### 11. Get Usage Statistics

```
GET /api/usage
```

**Auth:** Optional (returns free tier limits if no token)

**Response:**
```json
{
  "limit": 3,
  "remaining": 2,
  "resetInHours": 14
}
```

---

## Authentication Flow

### JWT Verification (Server-Side)

The worker verifies Auth0 RS256 JWT tokens by:
1. Fetching JWKS from `https://{AUTH0_DOMAIN}/.well-known/jwks.json` (cached 1 hour)
2. Importing the public key matching the token's `kid` header
3. Vering the signature using Web Crypto API (RSASSA-PKCS1-v1_5)
4. Validating `exp`, `nbf`, `iss`, and `aud` claims

### Rate Limiting

| Plan | Daily AI Requests | Max Notes | Max Audio Storage |
|------|------------------|-----------|-------------------|
| Free | 3 | 10 | 50 MB |
| Premium | 50 | 100 | 1 GB |

Rate limit keys are per-calendar-day (UTC), resetting at midnight UTC.

### AI Fallback Strategy

1. Primary: Gemini (gemini-3.5-flash) with retry (2 retries, exponential backoff)
2. Fallback: OpenAI (gpt-4o-mini) when Gemini returns 500/502/503/429
3. If both fail with server errors: Returns `MODEL_UNAVAILABLE` to client

---

## Supabase Schema (Expected)

### Table: `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Internal user ID |
| `auth0_id` | Text (unique) | Auth0 `sub` claim |
| `email` | Text | User email |
| `plan` | Text | `free` or `premium` |
| `created_at` | Timestamp | Creation time |
| `updated_at` | Timestamp | Last update |

### Table: `notes`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Text (PK) | Note ID (client-generated) |
| `user_id` | UUID (FK) | Links to users.id |
| `title` | Text | Note title |
| `transcript` | Text | Full transcript |
| `idea_summary` | Text | AI-generated summary |
| `action_items` | Text | Markdown checkboxes |
| `category` | Text | `ideas` or `reminders` |
| `idea_name` | Text | `Idea` or `Note` |
| `scheduled_date` | Text | Target date/time |
| `project_start_date` | Text | Project start |
| `is_complex` | Boolean | Complex project flag |
| `sub_todos` | JSONB | Array of sub-task objects |
| `tags` | JSONB | Array of tag strings |
| `model_used` | Text | AI model identifier |
| `duration` | Integer | Duration in seconds |
| `audio_key` | Text | R2 object key (nullable) |
| `audio_bytes` | Integer | Audio file size |
| `created_at` | Timestamp | Creation time |

### Table: `user_settings`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID (PK, FK) | Links to users.id |
| `language` | Text | Locale code (en, es, fr, de, cs, sk, ja) |
| `theme` | Text | `light`, `dark`, `system` |
| `accent_color` | Text | `blue`, `orange`, `purple`, `green`, `red` |
| `action_button_action` | Text | `record`, `brainstorm`, `theme`, `none` |
| `custom_api_key` | Text | Optional custom Gemini API key |
| `updated_at` | Timestamp | Last update |

---

## Error Responses

| Status | Error Code | Description |
|--------|-----------|-------------|
| 400 | `Missing audio` / `Missing text` | Invalid request body |
| 401 | `Authentication required` / `invalid_token` | Missing or invalid JWT |
| 403 | `NOTE_LIMIT_REACHED` | User exceeded note cap |
| 413 | `STORAGE_LIMIT_EXCEEDED` | User exceeded audio storage cap |
| 429 | `RATE_LIMIT_EXCEEDED` | Daily AI request limit reached |
| 502 | `AI_ERROR` | AI provider returned error |
| 503 | `MODEL_UNAVAILABLE` | Both AI providers are overloaded |

---

## Mobile App Integration Notes

1. **Use PKCE flow** for mobile authentication (Auth0 native SDKs handle this)
2. **Request access token with audience** if you have an Auth0 API resource defined
3. **Cache tokens** - Auth0 mobile SDKs handle refresh automatically
4. **Audio recording** - Use platform-native audio capture, encode to webm/ogg with Opus codec
5. **Send base64 data URL** format: `data:audio/webm;base64,...`
6. **Handle rate limits** - Show user their remaining quota from `/api/usage`
7. **Offline support** - Store notes locally, sync when online via `/api/notes/sync`
