# NoteWave API — Cloudflare Worker

Backend for `napi.ccma-fetch.space`. Verifies Auth0 access tokens, proxies AI to
Gemini (server-side key), and proxies data to Supabase (service-role, scoped to
the authenticated user). No secrets in the client; no generic Gemini/DB proxy.

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/transcribe` | optional¹ | audio → structured note (Gemini) |
| POST | `/api/analyze-text` | optional¹ | text → structured note (Gemini) |
| POST | `/api/ai-agent` | required | chat over the user's notes (Gemini) |
| GET | `/api/usage` | optional | remaining daily quota |
| GET | `/api/notes` | required | list the user's notes (Supabase) |
| POST | `/api/notes/sync` | required | upsert the user's notes |
| DELETE | `/api/notes/:id` | required | delete one note |
| DELETE | `/api/notes/all` | required | wipe the user's notes |
| POST | `/api/user-settings` | required | save settings / plan |

¹ Optional auth = works anonymously for the public landing demo (rate-limited by
IP); a valid token raises the limit and ties usage to the user.

**Identity is always the verified token's `sub`** — the client-supplied `uid` is
ignored. The service-role key bypasses Supabase RLS, so ownership is enforced
here by filtering every query on `user_id`.

## One-time setup

### 1. Create an Auth0 API (for the `audience`)
Auth0 Dashboard → **Applications → APIs → Create API**:
- Name: `NoteWave API`
- Identifier: `https://napi.ccma-fetch.space`  ← this is the `audience`
- Signing algorithm: **RS256**

Then set the **same** identifier in two places:
- Frontend: `VITE_AUTH0_AUDIENCE=https://napi.ccma-fetch.space`
- This worker: `AUTH0_AUDIENCE` in `wrangler.toml` (already set to that value)

Without an API/audience, Auth0 issues an *opaque* token that can't be verified as
a JWT — this step is required.

### 2. Configure vars + secrets
Edit `wrangler.toml` → set `SUPABASE_URL` to your project URL. Then:

```bash
cd worker
npm install
npx wrangler secret put GEMINI_API_KEY              # your Gemini API key
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # Supabase service-role key
```

### 3. (Optional) real rate limiting
```bash
npx wrangler kv namespace create RATE_LIMIT
# paste the printed id into the [[kv_namespaces]] block in wrangler.toml
```

### 4. Deploy + bind the domain
```bash
npx wrangler deploy
```
Then in the Cloudflare dashboard: **Workers & Pages → notewave-api → Settings →
Domains & Routes → Add Custom Domain → `napi.ccma-fetch.space`**.

### 5. CORS
`ALLOWED_ORIGIN` in `wrangler.toml` must equal your site origin
(`https://picklemaster09.github.io`). localhost is allowed automatically for dev.

## Expected Supabase schema
- `users (id uuid pk, auth0_id text unique, email text, plan text, updated_at timestamptz)`
- `user_settings (user_id uuid fk, language, theme, accent_color, action_button_action, custom_api_key, updated_at)`
- `notes (id text pk, user_id uuid fk, title, transcript, idea_summary, action_items, category, idea_name, scheduled_date, project_start_date, is_complex bool, sub_todos jsonb, tags jsonb, model_used, duration int, created_at timestamptz)`

`/api/notes/sync` upserts on `notes.id`; `/api/user-settings` upserts on
`user_settings.user_id` — add a unique constraint on `user_settings.user_id`.

## Local dev
```bash
npx wrangler dev
```
Set the same secrets locally with `wrangler secret put` (or a `.dev.vars` file).
