-- ============================================================
-- Fast Travels Umrah CRM — Expenses Table
-- Run this in Supabase SQL Editor after 001_initial.sql
-- ============================================================

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'Umrah Supplier',
    'Airline / Ticket',
    'Hotel Supplier',
    'Transport Supplier',
    'Other Umrah Expense'
  )),
  supplier     TEXT NOT NULL,
  amount_pkr   NUMERIC NOT NULL CHECK (amount_pkr > 0),
  method       TEXT NOT NULL CHECK (method IN ('Cash', 'Bank', 'JazzCash', 'EasyPaisa')),
  note         TEXT NOT NULL DEFAULT ''
);

-- Enable Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write their company's expenses
CREATE POLICY "Authenticated users can manage expenses"
  ON expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
