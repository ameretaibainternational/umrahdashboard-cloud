-- ============================================================
-- Fast Travels Umrah CRM — R2 file storage + usage tracking
-- Run in Supabase SQL Editor after previous migrations.
-- ============================================================

-- Custom invoice PDF metadata
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS file_deleted_at TIMESTAMPTZ;

-- Hotel vouchers (persisted records + PDF metadata)
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
CREATE POLICY "auth_all" ON hotel_vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Running storage total (single row for now)
CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO storage_usage (total_bytes)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM storage_usage);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON storage_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Triggers: bump on insert, reduce on soft-delete
CREATE OR REPLACE FUNCTION bump_storage_usage() RETURNS trigger AS $$
BEGIN
  IF coalesce(NEW.file_size_bytes, 0) > 0 THEN
    UPDATE storage_usage
      SET total_bytes = total_bytes + NEW.file_size_bytes,
          updated_at = now()
    WHERE id = (SELECT id FROM storage_usage LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reduce_storage_usage() RETURNS trigger AS $$
BEGIN
  IF OLD.file_deleted_at IS NULL AND NEW.file_deleted_at IS NOT NULL THEN
    UPDATE storage_usage
      SET total_bytes = GREATEST(0, total_bytes - coalesce(OLD.file_size_bytes, 0)),
          updated_at = now()
    WHERE id = (SELECT id FROM storage_usage LIMIT 1);
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
