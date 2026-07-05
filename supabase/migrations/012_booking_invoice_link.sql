-- Link bookings created from custom invoices back to the invoice row
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_invoice_id UUID;
CREATE INDEX IF NOT EXISTS idx_bookings_source_invoice_id ON bookings(source_invoice_id);
