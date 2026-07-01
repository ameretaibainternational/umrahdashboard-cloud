-- Hotel contact numbers for hotel vouchers (separate from package calculator hotels)

CREATE TABLE IF NOT EXISTS hotel_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, city)
);

ALTER TABLE hotel_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON hotel_contacts;
CREATE POLICY "auth_all" ON hotel_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
