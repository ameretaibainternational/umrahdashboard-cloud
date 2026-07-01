-- Per-invoice title text (custom + package calculator invoices)

ALTER TABLE custom_invoices
  ADD COLUMN IF NOT EXISTS invoice_title_text TEXT NOT NULL DEFAULT 'INVOICE';

UPDATE custom_invoices
SET invoice_title_text = 'INVOICE'
WHERE invoice_title_text IS NULL OR trim(invoice_title_text) = '';

-- Remove from settings if an earlier migration added it there
ALTER TABLE invoice_settings DROP COLUMN IF EXISTS invoice_title_text;
