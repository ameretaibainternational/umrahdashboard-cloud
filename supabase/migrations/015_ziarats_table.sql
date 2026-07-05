-- Dynamic ziarat options (name + flat group rate in SAR)

CREATE TABLE IF NOT EXISTS ziarats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  rate_sar NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ziarats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON ziarats;
CREATE POLICY "auth_all" ON ziarats FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO ziarats (name, slug, rate_sar, sort_order)
SELECT 'Makkah Ziarat', 'makkah', COALESCE(v.makkah_ziarat_rate, 15), 1 FROM visa_settings v
UNION ALL
SELECT 'Madinah Ziarat', 'madinah', COALESCE(v.madina_ziarat_rate, 12), 2 FROM visa_settings v
UNION ALL
SELECT 'Badr Ziarat', 'badr', COALESCE(v.badr_ziarat_rate, 9), 3 FROM visa_settings v
UNION ALL
SELECT 'Taif Ziarat', 'taif', COALESCE(v.taif_ziarat_rate, 9), 4 FROM visa_settings v
UNION ALL
SELECT 'Walking Ziarats', 'walking', 0, 5 FROM visa_settings v
ON CONFLICT (slug) DO NOTHING;

-- If visa_settings row was missing during insert, ensure defaults exist
INSERT INTO ziarats (name, slug, rate_sar, sort_order) VALUES
  ('Makkah Ziarat', 'makkah', 15, 1),
  ('Madinah Ziarat', 'madinah', 12, 2),
  ('Badr Ziarat', 'badr', 9, 3),
  ('Taif Ziarat', 'taif', 9, 4),
  ('Walking Ziarats', 'walking', 0, 5)
ON CONFLICT (slug) DO NOTHING;
