import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { hasDirectDb } from '@/lib/sql'
import type { Payment } from '@/lib/types'

export type InitialBookingPaymentInput = {
  customer_name: string
  advance_pkr: number
  booking_date?: string
}

export async function recordInitialBookingPayment(
  bookingId: string,
  input: InitialBookingPaymentInput,
  userId: string,
): Promise<void> {
  const amount = Math.round(Number(input.advance_pkr))
  if (!Number.isFinite(amount) || amount <= 0) return

  const paymentDate = input.booking_date ?? new Date().toISOString().split('T')[0]
  const row: Omit<Payment, 'id' | 'created_at'> = {
    booking_id: bookingId,
    customer_name: input.customer_name,
    amount_pkr: amount,
    method: 'Cash',
    note: 'Advance received at booking',
    payment_date: paymentDate,
    created_by: userId,
  }

  if (isDemoMode()) {
    demoStore.addPaymentRecord(row)
    return
  }

  if (hasDirectDb()) {
    const { insertPayment } = await import('@/lib/crm-db')
    await insertPayment({
      booking_id: row.booking_id,
      customer_name: row.customer_name,
      amount_pkr: row.amount_pkr,
      method: row.method,
      note: row.note,
      payment_date: row.payment_date,
      created_by: userId,
    })
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.from('payments').insert({ ...row, created_by: userId })
  if (error?.message.includes('created_by') || error?.message.includes('schema cache')) {
    await supabase.from('payments').insert(row)
  }
}
