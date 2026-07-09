-- Alter payments table to allow NULL booking_id and add invoice_id linking to custom_invoices
ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES custom_invoices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
