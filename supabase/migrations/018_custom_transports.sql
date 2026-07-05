-- User-defined transport vehicles with per-pax SAR rates

CREATE TABLE IF NOT EXISTS custom_transports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rate_1_sar NUMERIC NOT NULL DEFAULT 0,
  rate_2_sar NUMERIC NOT NULL DEFAULT 0,
  rate_3_sar NUMERIC NOT NULL DEFAULT 0,
  rate_4_sar NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE custom_transports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "auth_all" ON custom_transports FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.custom_transports TO anon, authenticated, service_role;
