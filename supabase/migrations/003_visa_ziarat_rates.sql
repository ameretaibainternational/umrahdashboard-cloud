-- ============================================================
-- Fast Travels Umrah CRM — Visa Tiered Rates + Ziarat Rates
-- Run this in Supabase SQL Editor (after 002_expenses.sql)
-- ============================================================

-- Add tiered adult visa rate columns (replaces the old single adult_sar column)
ALTER TABLE visa_settings
  ADD COLUMN IF NOT EXISTS visa_rate_1_pax    NUMERIC NOT NULL DEFAULT 725,
  ADD COLUMN IF NOT EXISTS visa_rate_2_pax    NUMERIC NOT NULL DEFAULT 700,
  ADD COLUMN IF NOT EXISTS visa_rate_3_pax    NUMERIC NOT NULL DEFAULT 675,
  ADD COLUMN IF NOT EXISTS visa_rate_4_pax    NUMERIC NOT NULL DEFAULT 650,
  ADD COLUMN IF NOT EXISTS visa_rate_group_pax NUMERIC NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS makkah_ziarat_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS madina_ziarat_rate NUMERIC NOT NULL DEFAULT 0;

-- Backfill: if the old adult_sar value exists, copy it into all tiered columns
UPDATE visa_settings
SET
  visa_rate_1_pax     = COALESCE(adult_sar, 725),
  visa_rate_2_pax     = COALESCE(adult_sar, 700),
  visa_rate_3_pax     = COALESCE(adult_sar, 675),
  visa_rate_4_pax     = COALESCE(adult_sar, 650),
  visa_rate_group_pax = COALESCE(adult_sar, 600)
WHERE adult_sar IS NOT NULL
  AND visa_rate_1_pax = 725; -- only backfill rows that still have the default (not yet set)
