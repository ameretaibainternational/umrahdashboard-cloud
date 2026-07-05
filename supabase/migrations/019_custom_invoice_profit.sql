-- Custom invoice profit tracking + link expenses to invoices

ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS profit_pkr NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES custom_invoices(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_invoice_id ON expenses(invoice_id);
