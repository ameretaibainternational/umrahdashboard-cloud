-- Run this ONCE in Supabase SQL Editor (or psql).
-- Sets up Admin / Moderator / Viewer roles, record ownership, and indexes.

-- ── 1. Ownership columns ─────────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id);
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id);
ALTER TABLE hotel_vouchers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id);

CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_invoices_created_by ON custom_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_hotel_vouchers_created_by ON hotel_vouchers(created_by);

-- ── 2. Migrate existing staff to new roles ───────────────────────────────────
-- Admin: full access
UPDATE staff_users
SET role = 'Admin', permission = 'Full Access'
WHERE permission = 'Full Access' OR role = 'Admin';

-- Viewer: package calculator only
UPDATE staff_users
SET role = 'Viewer', permission = 'View Only'
WHERE role = 'Viewer' OR permission = 'View Only';

-- Everyone else becomes Moderator (own records only)
UPDATE staff_users
SET role = 'Moderator', permission = 'Moderator'
WHERE permission NOT IN ('Full Access', 'View Only')
  AND role NOT IN ('Admin', 'Viewer');

-- ── Done ─────────────────────────────────────────────────────────────────────
SELECT id, name, username, role, permission, status FROM staff_users ORDER BY name;

-- ── 3. Reload Supabase API schema cache (required after adding columns) ─────
NOTIFY pgrst, 'reload schema';

SELECT 'Migration complete. created_by columns added and API schema reloaded.' AS status;
