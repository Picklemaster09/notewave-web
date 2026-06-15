-- Migration 2: Add Audio Key to Notes
-- Adds audio_key and audio_bytes columns for R2 cloud audio storage.
-- Prerequisite: Migration 1 (Core Schema) must be applied first.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS audio_key TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS audio_bytes BIGINT DEFAULT 0;
