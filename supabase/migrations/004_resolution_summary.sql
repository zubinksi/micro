-- Migration 004: Add AI resolution summary column

ALTER TABLE resolutions ADD COLUMN IF NOT EXISTS summary text DEFAULT NULL;
