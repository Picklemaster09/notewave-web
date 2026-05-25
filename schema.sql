-- NoteWave Supabase Postgres schema
-- Run this in the Supabase SQL editor for your project.
-- All privileged operations go through the backend (service-role key).
-- Direct client access to this database is intentionally disabled.

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── Users ────────────────────────────────────────────────────────────────────
-- Maps Auth0 user IDs to internal app users.
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_id    TEXT        UNIQUE NOT NULL,          -- e.g. "auth0|abc123"
  email       TEXT,
  plan        TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users (auth0_id);

-- ── Notes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id                  TEXT        PRIMARY KEY,       -- client-generated UUID
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL DEFAULT '',
  transcript          TEXT        NOT NULL DEFAULT '',
  idea_summary        TEXT        NOT NULL DEFAULT '',
  action_items        TEXT        NOT NULL DEFAULT '',
  category            TEXT        NOT NULL DEFAULT 'ideas' CHECK (category IN ('ideas','reminders')),
  idea_name           TEXT        NOT NULL DEFAULT '',
  scheduled_date      TEXT        NOT NULL DEFAULT '',
  project_start_date  TEXT        NOT NULL DEFAULT '',
  is_complex          BOOLEAN     NOT NULL DEFAULT FALSE,
  sub_todos           JSONB       NOT NULL DEFAULT '[]',   -- [{id,text,completed}]
  tags                TEXT[]      NOT NULL DEFAULT '{}',
  model_used          TEXT        NOT NULL DEFAULT '',
  duration            INTEGER     NOT NULL DEFAULT 0,      -- seconds
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id     ON notes (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at  ON notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_category    ON notes (user_id, category);

-- ── User settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id              UUID   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language             TEXT   NOT NULL DEFAULT 'en',
  theme                TEXT   NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','system')),
  accent_color         TEXT   NOT NULL DEFAULT 'blue',
  action_button_action TEXT   NOT NULL DEFAULT 'record',
  custom_api_key       TEXT,                        -- user's personal Gemini key, stored server-side only
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Usage events ─────────────────────────────────────────────────────────────
-- Lightweight append-only log used to enforce daily quotas per user.
CREATE TABLE IF NOT EXISTS usage_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,                 -- 'transcription' | 'analysis'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_type_time
  ON usage_events (user_id, event_type, created_at DESC);

-- ── RLS: deny all direct client access ───────────────────────────────────────
-- The backend uses the service-role key which bypasses RLS.
-- These policies prevent accidental direct access from the frontend.
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events  ENABLE ROW LEVEL SECURITY;

-- No policies = no rows accessible to anon/authenticated Supabase tokens.
-- All access goes through the Express backend with the service-role key.

-- ── Utility: update updated_at automatically ─────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
