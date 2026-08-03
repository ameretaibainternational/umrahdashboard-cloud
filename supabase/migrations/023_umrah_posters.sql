-- ============================================================
-- Fast Travels Umrah CRM — Umrah poster persistence + storage
-- Run in Supabase SQL Editor after previous migrations.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS umrah_poster_seq START 1;

CREATE TABLE IF NOT EXISTS umrah_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_number TEXT NOT NULL UNIQUE
    DEFAULT ('UP-' || LPAD(NEXTVAL('umrah_poster_seq')::TEXT, 3, '0')),
  title TEXT NOT NULL DEFAULT '',
  poster_date DATE NOT NULL DEFAULT CURRENT_DATE,
  poster_data JSONB NOT NULL DEFAULT '{}',
  branding_data JSONB NOT NULL DEFAULT '{}',
  calc_data JSONB,
  storage_key TEXT,
  file_size_bytes BIGINT,
  file_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES staff_users(id)
);

ALTER TABLE umrah_posters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON umrah_posters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_poster_insert ON umrah_posters;
CREATE TRIGGER trg_poster_insert AFTER INSERT ON umrah_posters
  FOR EACH ROW EXECUTE FUNCTION bump_storage_usage();

DROP TRIGGER IF EXISTS trg_poster_softdelete ON umrah_posters;
CREATE TRIGGER trg_poster_softdelete AFTER UPDATE ON umrah_posters
  FOR EACH ROW EXECUTE FUNCTION reduce_storage_usage();
