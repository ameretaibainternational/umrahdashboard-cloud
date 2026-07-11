import {
  hasDirectDb,
  isDirectDbConnectionError,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
  requireSql,
  requireWriteSql,
} from '@/lib/sql'
import type { Booking, Expense, Payment } from '@/lib/types'

let ownershipColumnsEnsured = false

/** Adds created_by columns if missing — best-effort, never blocks reads. */
export async function ensureOwnershipColumns(): Promise<void> {
  if (ownershipColumnsEnsured || !hasDirectDb()) return
  try {
    const sql = requireWriteSql()
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by UUID`
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by UUID`
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID`
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE`
    await sql`ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS created_by UUID`
    await sql`ALTER TABLE hotel_vouchers ADD COLUMN IF NOT EXISTS created_by UUID`
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_invoice_id UUID`
    await sql`ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL`
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES custom_invoices(id) ON DELETE CASCADE`
    await sql`ALTER TABLE visa_settings ADD COLUMN IF NOT EXISTS visa_rate_5_pax NUMERIC NOT NULL DEFAULT 625`
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by)`
    await sql`CREATE INDEX IF NOT EXISTS idx_bookings_source_invoice_id ON bookings(source_invoice_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by)`
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by)`
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_booking_id ON expenses(booking_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_custom_invoices_created_by ON custom_invoices(created_by)`
    await sql`CREATE INDEX IF NOT EXISTS idx_hotel_vouchers_created_by ON hotel_vouchers(created_by)`
    await sql.unsafe(`NOTIFY pgrst, 'reload schema'`)
  } catch (error) {
    if (isDirectDbConnectionError(error)) markDirectDbAuthFailed()
  } finally {
    ownershipColumnsEnsured = true
  }
}

async function fetchOwnedRows<T extends { created_by?: string | null }>(
  load: (filterOwner: boolean) => Promise<T[]>,
  createdBy?: string | null,
): Promise<T[]> {
  if (!createdBy) return load(false)
  try {
    return await load(true)
  } catch (error) {
    if (!isDirectDbRecoverableError(error)) throw error
    const rows = await load(false)
    return rows.filter(row => !row.created_by || row.created_by === createdBy)
  }
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
  const sql = requireSql()
  const rows = await fetchOwnedRows(
    filterOwner => (filterOwner && createdBy
      ? sql<Booking[]>`SELECT * FROM bookings WHERE created_by = ${createdBy} ORDER BY created_at DESC`
      : sql<Booking[]>`SELECT * FROM bookings ORDER BY created_at DESC`),
    createdBy,
  )
  return rows.map(mapBooking)
}

export async function insertBooking(
  payload: Omit<Booking, 'id' | 'created_at'> & { booking_date?: string },
): Promise<string> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO bookings (
        booking_date, customer_name, airline_name,
        total_pkr, cost_pkr, profit_pkr, advance_pkr, paid_pkr, remaining_pkr,
        adult_count, child_count, infant_count,
        makkah_hotel_name, makkah_hotel_location, makkah_hotel_distance, makkah_room_type, makkah_nights,
        madinah_hotel_name, madinah_hotel_location, madinah_hotel_distance, madinah_room_type, madinah_nights,
        created_by, source_invoice_id
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
        ${payload.created_by ?? null}, ${payload.source_invoice_id ?? null}
      )
      RETURNING id
    `
    return row.id
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('source_invoice_id')) throw error
    const [row] = await sql<{ id: string }[]>`
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
      RETURNING id
    `
    return row.id
  }
}

export async function getBookingForPayment(bookingId: string): Promise<{
  customer_name: string
  total_pkr: number
  paid_pkr: number
  created_by: string | null
  source_invoice_id?: string | null
} | null> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  const [row] = await sql<{
    customer_name: string
    total_pkr: number
    paid_pkr: number
    created_by: string | null
    source_invoice_id: string | null
  }[]>`
    SELECT customer_name, total_pkr, paid_pkr, created_by, source_invoice_id FROM bookings WHERE id = ${bookingId}
  `
  if (!row) return null
  return {
    ...row,
    total_pkr: Number(row.total_pkr),
    paid_pkr: Number(row.paid_pkr),
  }
}

export async function deleteBookingById(id: string): Promise<void> {
  const sql = requireWriteSql()
  await sql`DELETE FROM bookings WHERE id = ${id}`
}

export async function fetchBookingById(id: string, createdBy?: string | null): Promise<Booking | null> {
  const sql = requireSql()
  const [row] = await sql<Booking[]>`
    SELECT * FROM bookings WHERE id = ${id}
  `
  if (!row) return null
  if (createdBy && row.created_by && row.created_by !== createdBy) return null
  return mapBooking(row)
}

export async function updateBookingById(
  id: string,
  payload: Omit<Booking, 'id' | 'created_at' | 'created_by'>,
): Promise<void> {
  const sql = requireWriteSql()
  await sql`
    UPDATE bookings SET
      booking_date = ${payload.booking_date},
      customer_name = ${payload.customer_name},
      airline_name = ${payload.airline_name},
      total_pkr = ${payload.total_pkr},
      cost_pkr = ${payload.cost_pkr},
      profit_pkr = ${payload.profit_pkr},
      advance_pkr = ${payload.advance_pkr},
      paid_pkr = ${payload.paid_pkr},
      remaining_pkr = ${payload.remaining_pkr},
      adult_count = ${payload.adult_count},
      child_count = ${payload.child_count},
      infant_count = ${payload.infant_count},
      makkah_hotel_name = ${payload.makkah_hotel_name},
      makkah_hotel_location = ${payload.makkah_hotel_location},
      makkah_hotel_distance = ${payload.makkah_hotel_distance},
      makkah_room_type = ${payload.makkah_room_type},
      makkah_nights = ${payload.makkah_nights},
      madinah_hotel_name = ${payload.madinah_hotel_name},
      madinah_hotel_location = ${payload.madinah_hotel_location},
      madinah_hotel_distance = ${payload.madinah_hotel_distance},
      madinah_room_type = ${payload.madinah_room_type},
      madinah_nights = ${payload.madinah_nights},
      source_invoice_id = ${payload.source_invoice_id ?? null}
    WHERE id = ${id}
  `
}

export async function getBookingOwner(id: string): Promise<string | null | undefined> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  const [row] = await sql<{ created_by: string | null }[]>`
    SELECT created_by FROM bookings WHERE id = ${id}
  `
  if (!row) return undefined
  return row.created_by
}

export async function insertPayment(row: {
  booking_id: string | null
  invoice_id?: string | null
  customer_name: string
  amount_pkr: number
  method: Payment['method']
  note: string
  payment_date: string
  created_by: string
}): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  await sql`
    INSERT INTO payments (booking_id, invoice_id, customer_name, amount_pkr, method, note, payment_date, created_by)
    VALUES (
      ${row.booking_id ?? null}, ${row.invoice_id ?? null}, ${row.customer_name}, ${row.amount_pkr},
      ${row.method}, ${row.note}, ${row.payment_date}, ${row.created_by}
    )
  `
}

export async function updateBookingPaidTotals(
  bookingId: string,
  paidPkr: number,
  remainingPkr: number,
): Promise<void> {
  const sql = requireWriteSql()
  await sql`
    UPDATE bookings SET paid_pkr = ${paidPkr}, remaining_pkr = ${remainingPkr} WHERE id = ${bookingId}
  `
}

export async function updateInvoiceReceivedTotals(
  invoiceId: string,
  amount: number,
): Promise<void> {
  const sql = requireWriteSql()
  await sql`
    UPDATE custom_invoices
    SET 
      received = received + ${amount},
      remaining = GREATEST(0, total - (received + ${amount}))
    WHERE id = ${invoiceId}
  `
}

export async function deletePaymentsForBooking(bookingId: string): Promise<void> {
  const sql = requireWriteSql()
  await sql`DELETE FROM payments WHERE booking_id = ${bookingId}`
  await sql`
    UPDATE bookings SET paid_pkr = 0, remaining_pkr = total_pkr WHERE id = ${bookingId}
  `
}

export async function fetchPayments(createdBy?: string | null): Promise<Payment[]> {
  const sql = requireSql()
  const rows = await fetchOwnedRows(
    filterOwner => (filterOwner && createdBy
      ? sql<Payment[]>`SELECT * FROM payments WHERE created_by = ${createdBy} ORDER BY created_at DESC`
      : sql<Payment[]>`SELECT * FROM payments ORDER BY created_at DESC`),
    createdBy,
  )
  return rows.map(r => ({ ...r, amount_pkr: Number(r.amount_pkr) }))
}

export async function insertExpense(row: {
  expense_type: Expense['expense_type']
  supplier: string
  amount_pkr: number
  method: Expense['method']
  note: string
  expense_date: string
  booking_id?: string | null
  invoice_id?: string | null
  created_by: string
}): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  try {
    await sql`
      INSERT INTO expenses (expense_type, supplier, amount_pkr, method, note, expense_date, booking_id, invoice_id, created_by)
      VALUES (
        ${row.expense_type}, ${row.supplier}, ${row.amount_pkr},
        ${row.method}, ${row.note}, ${row.expense_date}, ${row.booking_id ?? null}, ${row.invoice_id ?? null}, ${row.created_by}
      )
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('invoice_id')) {
      await sql`
        INSERT INTO expenses (expense_type, supplier, amount_pkr, method, note, expense_date, booking_id, created_by)
        VALUES (
          ${row.expense_type}, ${row.supplier}, ${row.amount_pkr},
          ${row.method}, ${row.note}, ${row.expense_date}, ${row.booking_id ?? null}, ${row.created_by}
        )
      `
      return
    }
    if (!message.includes('booking_id')) throw error
    await sql`
      INSERT INTO expenses (expense_type, supplier, amount_pkr, method, note, expense_date, created_by)
      VALUES (
        ${row.expense_type}, ${row.supplier}, ${row.amount_pkr},
        ${row.method}, ${row.note}, ${row.expense_date}, ${row.created_by}
      )
    `
  }
}

export async function deleteExpensesByInvoiceId(invoiceId: string): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  try {
    await sql`DELETE FROM expenses WHERE invoice_id = ${invoiceId}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('invoice_id')) throw error
  }
}

export async function fetchExpenses(createdBy?: string | null): Promise<Expense[]> {
  const sql = requireSql()
  const rows = await fetchOwnedRows(
    filterOwner => (filterOwner && createdBy
      ? sql<Expense[]>`SELECT * FROM expenses WHERE created_by = ${createdBy} ORDER BY created_at DESC`
      : sql<Expense[]>`SELECT * FROM expenses ORDER BY created_at DESC`),
    createdBy,
  )
  return rows.map(r => ({ ...r, amount_pkr: Number(r.amount_pkr) }))
}

export async function getExpenseOwner(id: string): Promise<string | null | undefined> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  const [row] = await sql<{ created_by: string | null }[]>`
    SELECT created_by FROM expenses WHERE id = ${id}
  `
  if (!row) return undefined
  return row.created_by
}

export async function deleteExpenseById(id: string): Promise<void> {
  const sql = requireWriteSql()
  await sql`DELETE FROM expenses WHERE id = ${id}`
}

type InvoiceBookingSnapshot = {
  customer_name: string
  booking_date: string
  total_pkr: number
}

function matchesInvoiceSnapshot(booking: Booking, snapshot: InvoiceBookingSnapshot): boolean {
  return (
    booking.customer_name === snapshot.customer_name &&
    booking.booking_date === snapshot.booking_date &&
    booking.total_pkr === snapshot.total_pkr
  )
}

export async function findBookingForCustomInvoiceDirect(
  invoiceId: string,
  snapshot: InvoiceBookingSnapshot,
  createdBy?: string | null,
): Promise<Booking | null> {
  await ensureOwnershipColumns()
  const sql = requireSql()

  try {
    const linked = createdBy
      ? await sql<Booking[]>`
          SELECT * FROM bookings
          WHERE source_invoice_id = ${invoiceId} AND created_by = ${createdBy}
          LIMIT 1
        `
      : await sql<Booking[]>`
          SELECT * FROM bookings WHERE source_invoice_id = ${invoiceId} LIMIT 1
        `
    if (linked[0]) return mapBooking(linked[0])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('source_invoice_id')) throw error
  }

  const rows = createdBy
    ? await sql<Booking[]>`
        SELECT * FROM bookings
        WHERE created_by = ${createdBy}
        ORDER BY created_at DESC
      `
    : await sql<Booking[]>`SELECT * FROM bookings ORDER BY created_at DESC`

  const match = rows.map(mapBooking).find(b => matchesInvoiceSnapshot(b, snapshot))
  return match ?? null
}

export async function linkBookingToInvoiceDirect(bookingId: string, invoiceId: string): Promise<void> {
  await ensureOwnershipColumns()
  const sql = requireWriteSql()
  try {
    await sql`UPDATE bookings SET source_invoice_id = ${invoiceId} WHERE id = ${bookingId}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('source_invoice_id')) throw error
  }
}
