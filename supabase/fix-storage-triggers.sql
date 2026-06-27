-- Fix: "UPDATE requires a WHERE clause" when saving custom invoices / hotel vouchers.
-- Supabase requires UPDATE statements to include WHERE. Run once in SQL Editor.

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

SELECT 'Storage triggers fixed. Try Save & Download Invoice again.' AS status;
