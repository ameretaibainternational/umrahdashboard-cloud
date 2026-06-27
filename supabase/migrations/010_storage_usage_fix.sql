-- Fix storage_usage counter when invoices/vouchers are hard-deleted or PDF size changes.

CREATE OR REPLACE FUNCTION reduce_storage_on_delete() RETURNS trigger AS $$
BEGIN
  IF coalesce(OLD.file_size_bytes, 0) > 0 AND OLD.file_deleted_at IS NULL THEN
    UPDATE storage_usage
      SET total_bytes = GREATEST(0, total_bytes - OLD.file_size_bytes),
          updated_at = now()
    WHERE id = (SELECT id FROM storage_usage LIMIT 1);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION adjust_storage_on_update() RETURNS trigger AS $$
BEGIN
  IF OLD.file_deleted_at IS NULL AND NEW.file_deleted_at IS NULL THEN
    IF coalesce(OLD.file_size_bytes, 0) <> coalesce(NEW.file_size_bytes, 0) THEN
      UPDATE storage_usage
        SET total_bytes = GREATEST(0, total_bytes - coalesce(OLD.file_size_bytes, 0) + coalesce(NEW.file_size_bytes, 0)),
            updated_at = now()
      WHERE id = (SELECT id FROM storage_usage LIMIT 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_delete ON custom_invoices;
CREATE TRIGGER trg_invoice_delete BEFORE DELETE ON custom_invoices
  FOR EACH ROW EXECUTE FUNCTION reduce_storage_on_delete();

DROP TRIGGER IF EXISTS trg_voucher_delete ON hotel_vouchers;
CREATE TRIGGER trg_voucher_delete BEFORE DELETE ON hotel_vouchers
  FOR EACH ROW EXECUTE FUNCTION reduce_storage_on_delete();

DROP TRIGGER IF EXISTS trg_invoice_update_size ON custom_invoices;
CREATE TRIGGER trg_invoice_update_size AFTER UPDATE ON custom_invoices
  FOR EACH ROW EXECUTE FUNCTION adjust_storage_on_update();

DROP TRIGGER IF EXISTS trg_voucher_update_size ON hotel_vouchers;
CREATE TRIGGER trg_voucher_update_size AFTER UPDATE ON hotel_vouchers
  FOR EACH ROW EXECUTE FUNCTION adjust_storage_on_update();

-- Reconcile counter with active PDF files.
UPDATE storage_usage
SET total_bytes = (
  SELECT coalesce(sum(file_size_bytes), 0) FROM (
    SELECT file_size_bytes FROM custom_invoices
      WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL AND coalesce(file_size_bytes, 0) > 0
    UNION ALL
    SELECT file_size_bytes FROM hotel_vouchers
      WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL AND coalesce(file_size_bytes, 0) > 0
  ) active_files
),
updated_at = now()
WHERE id = (SELECT id FROM storage_usage LIMIT 1);
