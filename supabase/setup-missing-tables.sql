-- ============================================================
-- IMPORTANT: Press Ctrl+A to select ALL lines, then click Run.
-- "Success. No rows returned" alone does NOT mean every table was created.
-- Scroll to the bottom — the final SELECT must show 4 table names.
-- Project must match .env.local: rvucrtiahhuadbezhnbs
-- ============================================================

-- BEFORE (expect 0 rows if tables are missing)
SELECT table_name AS before_setup
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('custom_invoices', 'invoice_settings', 'hotel_vouchers', 'storage_usage')
ORDER BY 1;

-- ── Custom invoices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_bank_name TEXT NOT NULL DEFAULT '',
  payment_account_number TEXT NOT NULL DEFAULT '',
  terms_text TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_location TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO invoice_settings (
  payment_bank_name, payment_account_number, terms_text,
  contact_phone, contact_email, contact_location
)
SELECT
  'Meezan Bank', '01234567890123',
  'All payments are due upon receipt. Late payments may incur additional charges. Services rendered are non-refundable once confirmed. Visa approval is subject to Saudi embassy decision and is not guaranteed.',
  '+92 300 0000000', 'info@fasttravels.pk', 'Lahore, Pakistan'
WHERE NOT EXISTS (SELECT 1 FROM invoice_settings LIMIT 1);

CREATE SEQUENCE IF NOT EXISTS custom_invoice_seq START 1;

CREATE TABLE IF NOT EXISTS custom_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE
    DEFAULT ('ATI-' || LPAD(NEXTVAL('custom_invoice_seq')::TEXT, 3, '0')),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  billed_to_name TEXT NOT NULL,
  billed_to_address TEXT NOT NULL DEFAULT '',
  billed_to_client_number TEXT NOT NULL DEFAULT '',
  payment_bank_name TEXT NOT NULL DEFAULT '',
  payment_account_number TEXT NOT NULL DEFAULT '',
  terms_text TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_location TEXT NOT NULL DEFAULT '',
  line_items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  received NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  storage_key TEXT,
  file_size_bytes BIGINT,
  file_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON invoice_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON custom_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON TABLE public.invoice_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.custom_invoices TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.custom_invoice_seq TO anon, authenticated, service_role;

-- ── Hotel voucher settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_voucher_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urdu_guidelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  urdu_footer TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hotel_voucher_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON hotel_voucher_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON TABLE public.hotel_voucher_settings TO anon, authenticated, service_role;

-- ── Hotel vouchers + storage usage ───────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS hotel_voucher_seq START 1;

CREATE TABLE IF NOT EXISTS hotel_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL UNIQUE
    DEFAULT ('HV-' || LPAD(NEXTVAL('hotel_voucher_seq')::TEXT, 3, '0')),
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT NOT NULL DEFAULT '',
  family_head TEXT NOT NULL DEFAULT '',
  package_info TEXT NOT NULL DEFAULT '',
  voucher_data JSONB NOT NULL DEFAULT '{}',
  storage_key TEXT,
  file_size_bytes BIGINT,
  file_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hotel_vouchers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON hotel_vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON TABLE public.hotel_vouchers TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hotel_voucher_seq TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO storage_usage (total_bytes)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM storage_usage);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON storage_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON TABLE public.storage_usage TO anon, authenticated, service_role;

-- Backfill storage columns if custom_invoices existed from an older partial run
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS file_deleted_at TIMESTAMPTZ;

-- Storage triggers
CREATE OR REPLACE FUNCTION bump_storage_usage() RETURNS trigger AS $$
BEGIN
  IF coalesce(NEW.file_size_bytes, 0) > 0 THEN
    UPDATE storage_usage
      SET total_bytes = total_bytes + NEW.file_size_bytes,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reduce_storage_usage() RETURNS trigger AS $$
BEGIN
  IF OLD.file_deleted_at IS NULL AND NEW.file_deleted_at IS NOT NULL THEN
    UPDATE storage_usage
      SET total_bytes = GREATEST(0, total_bytes - coalesce(OLD.file_size_bytes, 0)),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_insert ON custom_invoices;
CREATE TRIGGER trg_invoice_insert AFTER INSERT ON custom_invoices
  FOR EACH ROW EXECUTE FUNCTION bump_storage_usage();

DROP TRIGGER IF EXISTS trg_invoice_softdelete ON custom_invoices;
CREATE TRIGGER trg_invoice_softdelete AFTER UPDATE ON custom_invoices
  FOR EACH ROW EXECUTE FUNCTION reduce_storage_usage();

DROP TRIGGER IF EXISTS trg_voucher_insert ON hotel_vouchers;
CREATE TRIGGER trg_voucher_insert AFTER INSERT ON hotel_vouchers
  FOR EACH ROW EXECUTE FUNCTION bump_storage_usage();

DROP TRIGGER IF EXISTS trg_voucher_softdelete ON hotel_vouchers;
CREATE TRIGGER trg_voucher_softdelete AFTER UPDATE ON hotel_vouchers
  FOR EACH ROW EXECUTE FUNCTION reduce_storage_usage();

-- Tell Supabase API to reload table list (fixes "schema cache" errors)
NOTIFY pgrst, 'reload schema';

-- AFTER — must return 4 rows. If empty, the script did not run fully.
SELECT table_name AS after_setup
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('custom_invoices', 'invoice_settings', 'hotel_vouchers', 'storage_usage')
ORDER BY 1;
