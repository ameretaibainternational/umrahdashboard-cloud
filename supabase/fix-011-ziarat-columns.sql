-- Add Badr & Taif ziarat rate columns (if migration 011 was not run from the top).
-- Safe to run multiple times.

ALTER TABLE visa_settings
  ADD COLUMN IF NOT EXISTS badr_ziarat_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taif_ziarat_rate NUMERIC NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
