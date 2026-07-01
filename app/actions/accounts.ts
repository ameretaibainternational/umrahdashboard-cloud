'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireModeratorFeature } from '@/lib/permissions-server'
import { hasDirectDb } from '@/lib/sql'

export async function addPayment(formData: FormData) {
  const ctx = await requireModeratorFeature('accounts')
  if ('error' in ctx) return ctx
  const bookingId = formData.get('booking_id') as string
  const amount = Number(formData.get('amount_pkr'))
  const method = formData.get('method') as 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa'
  const note = (formData.get('note') as string) || ''

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a valid payment amount.' }
  }

  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === bookingId)
    if (!booking) return { error: 'Booking not found' }
    if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
      return { error: 'You can only add payments to your own bookings.' }
    }
    if (amount > booking.remaining_pkr) {
      return { error: `Payment cannot exceed the due amount (${booking.remaining_pkr.toLocaleString('en-PK')} PKR).` }
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
      const dueAmount = Math.max(0, booking.total_pkr - booking.paid_pkr)
      if (amount > dueAmount) {
        return { error: `Payment cannot exceed the due amount (${dueAmount.toLocaleString('en-PK')} PKR).` }
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
      const dueAmount = Math.max(0, booking.total_pkr - booking.paid_pkr)
      if (amount > dueAmount) {
        return { error: `Payment cannot exceed the due amount (${dueAmount.toLocaleString('en-PK')} PKR).` }
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

const EXPENSE_REVALIDATE_PATHS = ['/accounts', '/dashboard', '/reports']

export async function deleteExpense(id: string) {
  const ctx = await requireModeratorFeature('accounts')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    const expense = demoStore.expenses.find(e => e.id === id)
    if (!expense) return { error: 'Expense not found.' }
    if (!ctx.isAdmin && expense.created_by !== ctx.userId) {
      return { error: 'You can only delete your own expenses.' }
    }
    demoStore.deleteExpense(id)
    EXPENSE_REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  }

  try {
    if (hasDirectDb()) {
      const { deleteExpenseById, getExpenseOwner } = await import('@/lib/crm-db')
      if (!ctx.isAdmin) {
        const owner = await getExpenseOwner(id)
        if (owner === undefined) return { error: 'Expense not found.' }
        if (owner !== ctx.userId) return { error: 'You can only delete your own expenses.' }
      }
      await deleteExpenseById(id)
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      if (!ctx.isAdmin) {
        const { data: expense } = await supabase.from('expenses').select('created_by').eq('id', id).single()
        if (!expense) return { error: 'Expense not found.' }
        if (expense.created_by !== ctx.userId) return { error: 'You can only delete your own expenses.' }
      }
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) return { error: friendlyDbError(error.message) }
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
  }

  EXPENSE_REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteExpenses(ids: string[]) {
  if (ids.length === 0) return { error: 'No expenses selected.' }

  const uniqueIds = [...new Set(ids)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteExpense(id)
    if ('error' in result && result.error) {
      errors.push(result.error)
    } else {
      deleted++
    }
  }

  if (deleted === 0) {
    return { error: errors[0] ?? 'Delete failed.' }
  }

  if (errors.length > 0) {
    return { success: true, deleted, error: `${deleted} deleted, ${errors.length} failed.` }
  }

  return { success: true, deleted }
}

const PAYMENT_REVALIDATE_PATHS = ['/accounts', '/bookings', '/dashboard', '/reports']

export async function deleteLedgerEntry(bookingId: string) {
  const ctx = await requireModeratorFeature('accounts')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === bookingId)
    if (!booking) return { error: 'Booking not found.' }
    if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
      return { error: 'You can only delete your own ledger entries.' }
    }
    demoStore.deletePaymentsForBooking(bookingId)
    PAYMENT_REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  }

  try {
    if (hasDirectDb()) {
      const { deletePaymentsForBooking, getBookingOwner } = await import('@/lib/crm-db')
      if (!ctx.isAdmin) {
        const owner = await getBookingOwner(bookingId)
        if (owner === undefined) return { error: 'Booking not found.' }
        if (owner !== ctx.userId) return { error: 'You can only delete your own ledger entries.' }
      }
      await deletePaymentsForBooking(bookingId)
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: booking } = await supabase
        .from('bookings')
        .select('total_pkr, created_by')
        .eq('id', bookingId)
        .single()
      if (!booking) return { error: 'Booking not found.' }
      if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
        return { error: 'You can only delete your own ledger entries.' }
      }
      const { error: payError } = await supabase.from('payments').delete().eq('booking_id', bookingId)
      if (payError) return { error: friendlyDbError(payError.message) }
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ paid_pkr: 0, remaining_pkr: booking.total_pkr })
        .eq('id', bookingId)
      if (bookingError) return { error: friendlyDbError(bookingError.message) }
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
  }

  PAYMENT_REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteLedgerEntries(bookingIds: string[]) {
  if (bookingIds.length === 0) return { error: 'No ledger entries selected.' }

  const uniqueIds = [...new Set(bookingIds)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteLedgerEntry(id)
    if ('error' in result && result.error) {
      errors.push(result.error)
    } else {
      deleted++
    }
  }

  if (deleted === 0) {
    return { error: errors[0] ?? 'Delete failed.' }
  }

  if (errors.length > 0) {
    return { success: true, deleted, error: `${deleted} deleted, ${errors.length} failed.` }
  }

  return { success: true, deleted }
}
