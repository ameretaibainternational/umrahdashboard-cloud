import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { hasDirectDb } from '@/lib/sql'
import type { Expense } from '@/lib/types'

export type PackageExpenseInput = {
  customer_name: string
  cost_pkr: number
  total_pkr: number
  profit_pkr: number
  booking_date: string
  booking_id?: string | null
  created_by: string
}

/** Supplier cost recognized for cash received so far (proportional to payments). */
export function calculateRecognizedPackageCost(
  paidPkr: number,
  totalPkr: number,
  costPkr: number,
): number {
  const paid = Math.round(Number(paidPkr))
  const total = Math.round(Number(totalPkr))
  const cost = Math.round(Number(costPkr))
  if (!Number.isFinite(paid) || paid <= 0) return 0
  if (!Number.isFinite(total) || total <= 0) return 0
  if (!Number.isFinite(cost) || cost <= 0) return 0
  return Math.min(cost, Math.round(paid * (cost / total)))
}

export function buildPackageExpense(
  input: PackageExpenseInput & { paid_pkr?: number; recognized_cost_pkr?: number },
): Omit<Expense, 'id' | 'created_at'> | null {
  const amount = Math.round(
    Number(input.recognized_cost_pkr ?? input.cost_pkr),
  )
  if (!Number.isFinite(amount) || amount <= 0) return null

  const customer = input.customer_name.trim() || 'Walk-in Customer'
  const paid = Math.round(Number(input.paid_pkr ?? 0))
  const total = Math.round(Number(input.total_pkr))
  const profit = Math.round(Number(input.profit_pkr))

  return {
    expense_type: 'Umrah Supplier',
    supplier: customer,
    amount_pkr: amount,
    method: 'Cash',
    note: paid > 0 && total > 0
      ? `Package cost (auto) — ${customer} · Received ${paid} of ${total} PKR · Cost ${amount} PKR · Profit ${profit} PKR`
      : `Package cost (auto) — ${customer} · Package ${total} PKR · Profit ${profit} PKR`,
    expense_date: input.booking_date,
    booking_id: input.booking_id ?? null,
  }
}

export async function deletePackageExpensesForBooking(bookingId: string): Promise<void> {
  if (isDemoMode()) {
    demoStore.deleteExpensesForBooking(bookingId)
    return
  }

  if (hasDirectDb()) {
    const { deleteExpensesByBookingId } = await import('@/lib/crm-db')
    await deleteExpensesByBookingId(bookingId)
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('booking_id', bookingId)
  if (error?.message.includes('booking_id') || error?.message.includes('schema cache')) {
    return
  }
  if (error) throw new Error(error.message)
}

export async function syncPackageExpenseForBooking(input: {
  booking_id: string
  customer_name: string
  cost_pkr: number
  total_pkr: number
  profit_pkr: number
  booking_date: string
  paid_pkr: number
  created_by: string
}): Promise<void> {
  await deletePackageExpensesForBooking(input.booking_id)

  const recognized_cost_pkr = calculateRecognizedPackageCost(
    input.paid_pkr,
    input.total_pkr,
    input.cost_pkr,
  )
  const row = buildPackageExpense({ ...input, recognized_cost_pkr, paid_pkr: input.paid_pkr })
  if (!row) return

  if (isDemoMode()) {
    demoStore.addExpense({ ...row, created_by: input.created_by })
    return
  }

  if (hasDirectDb()) {
    const { insertExpense } = await import('@/lib/crm-db')
    await insertExpense({
      expense_type: row.expense_type,
      supplier: row.supplier,
      amount_pkr: row.amount_pkr,
      method: row.method,
      note: row.note,
      expense_date: row.expense_date,
      booking_id: input.booking_id,
      created_by: input.created_by,
    })
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const withOwner = { ...row, created_by: input.created_by }
  const { error } = await supabase.from('expenses').insert(withOwner)
  if (error?.message.includes('booking_id') || error?.message.includes('schema cache')) {
    const { booking_id: _, ...withoutBookingLink } = withOwner
    await supabase.from('expenses').insert(withoutBookingLink)
  }
}

/** Reconcile auto package expense from current booking paid total. */
export async function syncPackageExpenseFromBookingId(bookingId: string): Promise<void> {
  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === bookingId)
    if (!booking || !booking.source_invoice_id) return
    await syncPackageExpenseForBooking({
      booking_id: bookingId,
      customer_name: booking.customer_name,
      cost_pkr: booking.cost_pkr,
      total_pkr: booking.total_pkr,
      profit_pkr: booking.profit_pkr,
      booking_date: booking.booking_date,
      paid_pkr: booking.paid_pkr,
      created_by: booking.created_by ?? 'demo',
    })
    return
  }

  if (hasDirectDb()) {
    const { fetchBookingExpenseSnapshot } = await import('@/lib/crm-db')
    const booking = await fetchBookingExpenseSnapshot(bookingId)
    if (!booking?.source_invoice_id) return
    await syncPackageExpenseForBooking({
      booking_id: bookingId,
      customer_name: booking.customer_name,
      cost_pkr: booking.cost_pkr,
      total_pkr: booking.total_pkr,
      profit_pkr: booking.profit_pkr,
      booking_date: booking.booking_date,
      paid_pkr: booking.paid_pkr,
      created_by: booking.created_by ?? '',
    })
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('customer_name, cost_pkr, total_pkr, profit_pkr, booking_date, paid_pkr, created_by, source_invoice_id')
    .eq('id', bookingId)
    .single()
  if (error || !booking?.source_invoice_id) return

  await syncPackageExpenseForBooking({
    booking_id: bookingId,
    customer_name: booking.customer_name,
    cost_pkr: Number(booking.cost_pkr),
    total_pkr: Number(booking.total_pkr),
    profit_pkr: Number(booking.profit_pkr),
    booking_date: booking.booking_date,
    paid_pkr: Number(booking.paid_pkr),
    created_by: booking.created_by ?? '',
  })
}

/** @deprecated Use syncPackageExpenseFromBookingId after payments are recorded. */
export async function recordPackageExpense(input: PackageExpenseInput): Promise<void> {
  if (!input.booking_id) return
  await syncPackageExpenseForBooking({
    booking_id: input.booking_id,
    customer_name: input.customer_name,
    cost_pkr: input.cost_pkr,
    total_pkr: input.total_pkr,
    profit_pkr: input.profit_pkr,
    booking_date: input.booking_date,
    paid_pkr: input.total_pkr,
    created_by: input.created_by,
  })
}
