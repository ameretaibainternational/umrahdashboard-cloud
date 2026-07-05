-- Client-requested schema updates (June 2025)
-- IMPORTANT: Run this ENTIRE file in one go in Supabase SQL Editor (select all → Run).

-- Ziarat rates: Badr & Taif
ALTER TABLE visa_settings
  ADD COLUMN IF NOT EXISTS badr_ziarat_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taif_ziarat_rate NUMERIC NOT NULL DEFAULT 0;

-- Hotels: contact number + Room rate
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS room_sar NUMERIC NOT NULL DEFAULT 0;

-- Flight city lists (JSON arrays on company row)
ALTER TABLE company
  ADD COLUMN IF NOT EXISTS pk_flight_cities JSONB NOT NULL DEFAULT '["Islamabad","Lahore","Karachi","Peshawar","Multan","Sialkot","Faisalabad","Quetta"]'::jsonb,
  ADD COLUMN IF NOT EXISTS sa_flight_cities JSONB NOT NULL DEFAULT '["Jeddah","Madinah","Riyadh","Dammam"]'::jsonb;

-- Saved payment methods for custom invoices
CREATE TABLE IF NOT EXISTS public.invoice_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON public.invoice_payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON TABLE public.invoice_payment_methods TO anon, authenticated, service_role;

-- Saved service names for custom invoices
CREATE TABLE IF NOT EXISTS public.invoice_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON public.invoice_services FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON TABLE public.invoice_services TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
