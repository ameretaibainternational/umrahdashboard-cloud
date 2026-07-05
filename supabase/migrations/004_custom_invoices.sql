-- ============================================================
-- Fast Travels Umrah CRM — Custom Invoice Feature
-- Run in Supabase SQL Editor after the previous migrations.
-- ============================================================

-- Stores editable defaults for new custom invoices
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

-- Seed one row of defaults so the form always has pre-fills
INSERT INTO invoice_settings (
  payment_bank_name, payment_account_number, terms_text,
  contact_phone, contact_email, contact_location
) VALUES (
  'Meezan Bank',
  '01234567890123',
  'All payments are due upon receipt. Late payments may incur additional charges. Services rendered are non-refundable once confirmed. Visa approval is subject to Saudi embassy decision and is not guaranteed.',
  '+92 300 0000000',
  'info@fasttravels.pk',
  'Lahore, Pakistan'
) ON CONFLICT DO NOTHING;

-- Race-safe auto-incrementing invoice number (ATI-001, ATI-002, …)
CREATE SEQUENCE IF NOT EXISTS custom_invoice_seq START 1;

-- Custom invoices table — stores a full snapshot of all editable fields
CREATE TABLE IF NOT EXISTS custom_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auto-generated on INSERT; format ATI-001
  invoice_number TEXT NOT NULL UNIQUE
    DEFAULT ('ATI-' || LPAD(NEXTVAL('custom_invoice_seq')::TEXT, 3, '0')),

  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Billed To
  billed_to_name TEXT NOT NULL,
  billed_to_address TEXT NOT NULL DEFAULT '',
  billed_to_client_number TEXT NOT NULL DEFAULT '',

  -- Payment method snapshot (not a live reference to invoice_settings)
  payment_bank_name TEXT NOT NULL DEFAULT '',
  payment_account_number TEXT NOT NULL DEFAULT '',

  -- Terms snapshot
  terms_text TEXT NOT NULL DEFAULT '',

  -- Contact snapshot
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_location TEXT NOT NULL DEFAULT '',

  -- Line items: [{service, pax_price, pax_price_unit, total_pax, total, total_unit, received}]
  line_items JSONB NOT NULL DEFAULT '[]',

  -- Aggregates (pre-computed at creation time for fast reads)
  total NUMERIC NOT NULL DEFAULT 0,
  received NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON invoice_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON custom_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
