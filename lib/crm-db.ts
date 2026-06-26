import { requireSql } from '@/lib/sql'
import type { Booking, Expense, Payment } from '@/lib/types'

let ownershipColumnsEnsured = false

/** Adds created_by columns if missing — safe to run repeatedly. */
export async function ensureOwnershipColumns(): Promise<void> {
  if (ownershipColumnsEnsured) return
  const sql = requireSql()
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id)`
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id)`
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id)`
  await sql`ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id)`
  await sql`ALTER TABLE hotel_vouchers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff_users(id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by)`
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by)`
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by)`
  await sql`CREATE INDEX IF NOT EXISTS idx_custom_invoices_created_by ON custom_invoices(created_by)`
  await sql`CREATE INDEX IF NOT EXISTS idx_hotel_vouchers_created_by ON hotel_vouchers(created_by)`
  ownershipColumnsEnsured = true
}

function mapBooking(row: Booking): Booking {
  return {
    ...row,
    total_pkr: Number(row.total_pkr),
    cost_pkr: Number(row.cost_pkr),
    profit_pkr: Number(row.profit_pkr),
    advance_pkr: Number(row.advance_pkr),
    paid_pkr: Number(row.paid_pkr),
    remaining_pkr: Number(row.remaining_pkr),
    adult_count: Number(row.adult_count),
    child_count: Number(row.child_count),
    infant_count: Number(row.infant_count),
    makkah_nights: row.makkah_nights != null ? Number(row.makkah_nights) : null,
    madinah_nights: row.madinah_nights != null ? Number(row.madinah_nights) : null,
  }
}

export async function fetchBookings(createdBy?: string | null): Promise<Booking[]> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  const rows = createdBy
    ? await sql<Booking[]>`
        SELECT * FROM bookings WHERE created_by = ${createdBy} ORDER BY created_at DESC
      `
    : await sql<Booking[]>`
        SELECT * FROM bookings ORDER BY created_at DESC
      `
  return rows.map(mapBooking)
}

export async function insertBooking(
  payload: Omit<Booking, 'id' | 'created_at'> & { booking_date?: string },
): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  await sql`
    INSERT INTO bookings (
      booking_date, customer_name, airline_name,
      total_pkr, cost_pkr, profit_pkr, advance_pkr, paid_pkr, remaining_pkr,
      adult_count, child_count, infant_count,
      makkah_hotel_name, makkah_hotel_location, makkah_hotel_distance, makkah_room_type, makkah_nights,
      madinah_hotel_name, madinah_hotel_location, madinah_hotel_distance, madinah_room_type, madinah_nights,
      created_by
    ) VALUES (
      ${payload.booking_date ?? new Date().toISOString().slice(0, 10)},
      ${payload.customer_name}, ${payload.airline_name},
      ${payload.total_pkr}, ${payload.cost_pkr}, ${payload.profit_pkr},
      ${payload.advance_pkr}, ${payload.paid_pkr}, ${payload.remaining_pkr},
      ${payload.adult_count}, ${payload.child_count}, ${payload.infant_count},
      ${payload.makkah_hotel_name}, ${payload.makkah_hotel_location}, ${payload.makkah_hotel_distance},
      ${payload.makkah_room_type}, ${payload.makkah_nights},
      ${payload.madinah_hotel_name}, ${payload.madinah_hotel_location}, ${payload.madinah_hotel_distance},
      ${payload.madinah_room_type}, ${payload.madinah_nights},
      ${payload.created_by ?? null}
    )
  `
}

export async function getBookingForPayment(bookingId: string): Promise<{
  customer_name: string
  total_pkr: number
  paid_pkr: number
  created_by: string | null
} | null> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  const [row] = await sql<{
    customer_name: string
    total_pkr: number
    paid_pkr: number
    created_by: string | null
  }[]>`
    SELECT customer_name, total_pkr, paid_pkr, created_by FROM bookings WHERE id = ${bookingId}
  `
  if (!row) return null
  return {
    ...row,
    total_pkr: Number(row.total_pkr),
    paid_pkr: Number(row.paid_pkr),
  }
}

export async function deleteBookingById(id: string): Promise<void> {
  const sql = requireSql()
  await sql`DELETE FROM bookings WHERE id = ${id}`
}

export async function getBookingOwner(id: string): Promise<string | null | undefined> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  const [row] = await sql<{ created_by: string | null }[]>`
    SELECT created_by FROM bookings WHERE id = ${id}
  `
  if (!row) return undefined
  return row.created_by
}

export async function insertPayment(row: {
  booking_id: string
  customer_name: string
  amount_pkr: number
  method: Payment['method']
  note: string
  payment_date: string
  created_by: string
}): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  await sql`
    INSERT INTO payments (booking_id, customer_name, amount_pkr, method, note, payment_date, created_by)
    VALUES (
      ${row.booking_id}, ${row.customer_name}, ${row.amount_pkr},
      ${row.method}, ${row.note}, ${row.payment_date}, ${row.created_by}
    )
  `
}

export async function updateBookingPaidTotals(
  bookingId: string,
  paidPkr: number,
  remainingPkr: number,
): Promise<void> {
  const sql = requireSql()
  await sql`
    UPDATE bookings SET paid_pkr = ${paidPkr}, remaining_pkr = ${remainingPkr} WHERE id = ${bookingId}
  `
}

export async function fetchPayments(createdBy?: string | null): Promise<Payment[]> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  const rows = createdBy
    ? await sql<Payment[]>`
        SELECT * FROM payments WHERE created_by = ${createdBy} ORDER BY created_at DESC
      `
    : await sql<Payment[]>`
        SELECT * FROM payments ORDER BY created_at DESC
      `
  return rows.map(r => ({ ...r, amount_pkr: Number(r.amount_pkr) }))
}

export async function insertExpense(row: {
  expense_type: Expense['expense_type']
  supplier: string
  amount_pkr: number
  method: Expense['method']
  note: string
  expense_date: string
  created_by: string
}): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  await sql`
    INSERT INTO expenses (expense_type, supplier, amount_pkr, method, note, expense_date, created_by)
    VALUES (
      ${row.expense_type}, ${row.supplier}, ${row.amount_pkr},
      ${row.method}, ${row.note}, ${row.expense_date}, ${row.created_by}
    )
  `
}

export async function fetchExpenses(createdBy?: string | null): Promise<Expense[]> {
  await ensureOwnershipColumns()
  const sql = requireSql()
  const rows = createdBy
    ? await sql<Expense[]>`
        SELECT * FROM expenses WHERE created_by = ${createdBy} ORDER BY created_at DESC
      `
    : await sql<Expense[]>`
        SELECT * FROM expenses ORDER BY created_at DESC
      `
  return rows.map(r => ({ ...r, amount_pkr: Number(r.amount_pkr) }))
}
