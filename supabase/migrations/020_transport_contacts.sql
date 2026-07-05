-- Transport contacts for hotel vouchers
CREATE TABLE IF NOT EXISTS transport_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, city)
);

ALTER TABLE transport_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON transport_contacts;
CREATE POLICY "auth_all" ON transport_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.transport_contacts TO anon, authenticated, service_role;
