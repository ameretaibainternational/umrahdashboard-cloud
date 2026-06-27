-- Package calculator invoices stored in custom_invoices (same table as custom invoices)

ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS invoice_kind TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS package_data JSONB;

NOTIFY pgrst, 'reload schema';
