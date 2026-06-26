-- Hotel voucher page-2 Urdu guidelines (single-row settings table)

CREATE TABLE IF NOT EXISTS hotel_voucher_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urdu_guidelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  urdu_footer TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hotel_voucher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON hotel_voucher_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
