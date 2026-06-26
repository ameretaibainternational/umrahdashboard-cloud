'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireModeratorFeature } from '@/lib/permissions-server'
import { hasDirectDb } from '@/lib/sql'
import type { ExpenseType } from '@/lib/types'

export async function addPayment(formData: FormData) {
  const ctx = await requireModeratorFeature('accounts')
  if ('error' in ctx) return ctx
  const bookingId = formData.get('booking_id') as string
  const amount = Number(formData.get('amount_pkr'))
  const method = formData.get('method') as 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa'
  const note = (formData.get('note') as string) || ''

  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === bookingId)
    if (!booking) return { error: 'Booking not found' }
    if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
      return { error: 'You can only add payments to your own bookings.' }
    }
    demoStore.addPayment({
      booking_id: bookingId,
      customer_name: booking.customer_name,
      amount_pkr: amount,
      method,
      note,
      payment_date: new Date().toISOString().split('T')[0],
      created_by: ctx.userId,
    })
    revalidatePath('/accounts'); revalidatePath('/bookings')
    revalidatePath('/dashboard'); revalidatePath('/reports')
    return { success: true }
  }

  try {
    if (hasDirectDb()) {
      const { getBookingForPayment, insertPayment, updateBookingPaidTotals } = await import('@/lib/crm-db')
      const booking = await getBookingForPayment(bookingId)
      if (!booking) return { error: 'Booking not found' }
      if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
        return { error: 'You can only add payments to your own bookings.' }
      }
      const paymentDate = new Date().toISOString().split('T')[0]
      await insertPayment({
        booking_id: bookingId,
        customer_name: booking.customer_name,
        amount_pkr: amount,
        method,
        note,
        payment_date: paymentDate,
        created_by: ctx.userId,
      })
      const newPaid = booking.paid_pkr + amount
      await updateBookingPaidTotals(bookingId, newPaid, Math.max(0, booking.total_pkr - newPaid))
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: booking, error: bookingError } = await supabase
        .from('bookings').select('customer_name, total_pkr, paid_pkr, created_by').eq('id', bookingId).single()
      if (bookingError || !booking) return { error: 'Booking not found' }
      if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
        return { error: 'You can only add payments to your own bookings.' }
      }
      const { error: payError } = await supabase.from('payments').insert({
        booking_id: bookingId,
        customer_name: booking.customer_name,
        amount_pkr: amount, method, note,
        payment_date: new Date().toISOString().split('T')[0],
        created_by: ctx.userId,
      })
      if (payError) return { error: payError.message }
      const newPaid = booking.paid_pkr + amount
      await supabase.from('bookings')
        .update({ paid_pkr: newPaid, remaining_pkr: Math.max(0, booking.total_pkr - newPaid) })
        .eq('id', bookingId)
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Payment failed') }
  }

  revalidatePath('/accounts'); revalidatePath('/bookings')
  revalidatePath('/dashboard'); revalidatePath('/reports')
  return { success: true }
}

export async function addExpense(formData: FormData) {
  const ctx = await requireModeratorFeature('accounts')
  if ('error' in ctx) return ctx
  const expenseType = formData.get('expense_type') as ExpenseType
  const supplier = (formData.get('supplier') as string).trim()
  const amount = Number(formData.get('amount_pkr'))
  const method = formData.get('method') as 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa'
  const note = (formData.get('note') as string) || ''
  const expenseDate = (formData.get('expense_date') as string) || new Date().toISOString().split('T')[0]

  if (!supplier) return { error: 'Supplier / description is required' }
  if (amount <= 0) return { error: 'Amount must be greater than zero' }

  if (isDemoMode()) {
    demoStore.addExpense({
      expense_type: expenseType,
      supplier,
      amount_pkr: amount,
      method,
      note,
      expense_date: expenseDate,
      created_by: ctx.userId,
    })
    revalidatePath('/accounts')
    return { success: true }
  }

  try {
    if (hasDirectDb()) {
      const { insertExpense } = await import('@/lib/crm-db')
      await insertExpense({
        expense_type: expenseType,
        supplier,
        amount_pkr: amount,
        method,
        note,
        expense_date: expenseDate,
        created_by: ctx.userId,
      })
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { error } = await supabase.from('expenses').insert({
        expense_type: expenseType,
        supplier,
        amount_pkr: amount,
        method,
        note,
        expense_date: expenseDate,
        created_by: ctx.userId,
      })
      if (error) return { error: error.message }
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Expense failed') }
  }

  revalidatePath('/accounts')
  return { success: true }
}
