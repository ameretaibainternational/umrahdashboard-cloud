-- Link auto-generated package expenses to bookings (optional FK)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_booking_id ON expenses(booking_id);
