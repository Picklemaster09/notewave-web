-- Migration 3: Add Task Priority and Category to Notes
-- Adds task_priority and task_category columns for AI-categorized and user-editable
-- priority/category fields on tasks and notes.
-- Prerequisites: Migration 1 (Core Schema) and Migration 2 (Audio Key) must be applied first.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS task_priority TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS task_category TEXT;

-- Add comments for documentation
COMMENT ON COLUMN notes.task_priority IS 'Task priority level: Low, Medium, High, Urgent';
COMMENT ON COLUMN notes.task_category IS 'Task category: Work, Personal, Health, Learning, Ideas';
