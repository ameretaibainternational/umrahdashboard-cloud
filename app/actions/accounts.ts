'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireModeratorFeature } from '@/lib/permissions-server'
import { hasDirectDb, requireWriteSql } from '@/lib/sql'

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

  if (bookingId.startsWith('invoice-')) {
    const invoiceId = bookingId.replace('invoice-', '')
    if (isDemoMode()) {
      const inv = demoStore.customInvoices.find(i => i.id === invoiceId)
      if (!inv) return { error: 'Invoice not found' }
      if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
        return { error: 'You can only add payments to your own invoices.' }
      }
      if (amount > inv.remaining) {
        return { error: `Payment cannot exceed the due amount (${inv.remaining.toLocaleString('en-PK')} PKR).` }
      }
      demoStore.addPayment({
        booking_id: null,
        invoice_id: invoiceId,
        customer_name: inv.billed_to_name,
        amount_pkr: amount,
        method,
        note,
        payment_date: new Date().toISOString().split('T')[0],
        created_by: ctx.userId,
      } as any)
      inv.received += amount
      inv.remaining = Math.max(0, inv.total - inv.received)
    } else {
      try {
        if (hasDirectDb()) {
          const sql = requireWriteSql()
          const [inv] = await sql<{ total: number; received: number; remaining: number; billed_to_name: string; created_by: string }[]>`
            SELECT total, received, remaining, billed_to_name, created_by FROM custom_invoices WHERE id = ${invoiceId}
          `
          if (!inv) return { error: 'Invoice not found' }
          if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
            return { error: 'You can only add payments to your own invoices.' }
          }
          const dueAmount = Number(inv.remaining)
          if (amount > dueAmount) {
            return { error: `Payment cannot exceed the due amount (${dueAmount.toLocaleString('en-PK')} PKR).` }
          }
          const paymentDate = new Date().toISOString().split('T')[0]
          await sql`
            INSERT INTO payments (booking_id, invoice_id, customer_name, amount_pkr, method, note, payment_date, created_by)
            VALUES (null, ${invoiceId}, ${inv.billed_to_name}, ${amount}, ${method}, ${note}, ${paymentDate}, ${ctx.userId})
          `
          const newReceived = Number(inv.received) + amount
          const newRemaining = Math.max(0, Number(inv.total) - newReceived)
          await sql`
            UPDATE custom_invoices SET received = ${newReceived}, remaining = ${newRemaining} WHERE id = ${invoiceId}
          `
        } else {
          const { createClient } = await import('@/lib/supabase/server')
          const supabase = await createClient()
          const { data: inv, error: invError } = await supabase
            .from('custom_invoices')
            .select('billed_to_name, total, received, remaining, created_by')
            .eq('id', invoiceId)
            .single()
          if (invError || !inv) return { error: 'Invoice not found' }
          if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
            return { error: 'You can only add payments to your own invoices.' }
          }
          const dueAmount = Number(inv.remaining)
          if (amount > dueAmount) {
            return { error: `Payment cannot exceed the due amount (${dueAmount.toLocaleString('en-PK')} PKR).` }
          }
          let { error: payError } = await supabase.from('payments').insert({
            booking_id: null,
            invoice_id: invoiceId,
            customer_name: inv.billed_to_name,
            amount_pkr: amount,
            method,
            note,
            payment_date: new Date().toISOString().split('T')[0],
            created_by: ctx.userId,
          })
          if (payError && (payError.message.includes('invoice_id') || payError.message.includes('schema cache'))) {
            try {
              const { getSql } = await import('@/lib/sql')
              const rawSql = getSql()
              if (rawSql) {
                await rawSql`NOTIFY pgrst, 'reload schema'`
                await new Promise(resolve => setTimeout(resolve, 1000))
                const retryResult = await supabase.from('payments').insert({
                  booking_id: null,
                  invoice_id: invoiceId,
                  customer_name: inv.billed_to_name,
                  amount_pkr: amount,
                  method,
                  note,
                  payment_date: new Date().toISOString().split('T')[0],
                  created_by: ctx.userId,
                })
                payError = retryResult.error
              }
            } catch (e) {
              console.error('Failed to notify schema cache reload:', e)
            }
          }
          if (payError) {
            if (payError.message.includes('invoice_id') || payError.message.includes('schema cache')) {
              const { error: fallbackError } = await supabase.from('payments').insert({
                booking_id: null,
                customer_name: inv.billed_to_name,
                amount_pkr: amount,
                method,
                note,
                payment_date: new Date().toISOString().split('T')[0],
                created_by: ctx.userId,
              })
              if (fallbackError) return { error: fallbackError.message }
            } else {
              return { error: payError.message }
            }
          }
          const newReceived = Number(inv.received) + amount
          const newRemaining = Math.max(0, Number(inv.total) - newReceived)
          await supabase.from('custom_invoices')
            .update({ received: newReceived, remaining: newRemaining })
            .eq('id', invoiceId)
        }
      } catch (e) {
        return { error: friendlyDbError(e instanceof Error ? e.message : 'Payment failed') }
      }
    }
    revalidatePath('/accounts'); revalidatePath('/bookings')
    revalidatePath('/dashboard'); revalidatePath('/reports')
    return { success: true }
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

    if (booking.source_invoice_id) {
      const inv = demoStore.customInvoices.find(i => i.id === booking.source_invoice_id)
      if (inv) {
        const isSar = inv.package_data?.currencyUnit === 'SAR'
        const rate = Number(inv.package_data?.sarToPkr || 75)
        const convertedAmount = isSar ? amount / rate : amount
        inv.received += convertedAmount
        inv.remaining = Math.max(0, inv.total - inv.received)
      }
    }

    revalidatePath('/accounts'); revalidatePath('/bookings')
    revalidatePath('/dashboard'); revalidatePath('/reports')
    return { success: true }
  }

  try {
    if (hasDirectDb()) {
      const { getBookingForPayment, insertPayment, updateBookingPaidTotals, updateInvoiceReceivedTotals } = await import('@/lib/crm-db')
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

      if (booking.source_invoice_id) {
        const { requireSql } = await import('@/lib/sql')
        const sql = requireSql()
        const [inv] = await sql<{ package_data: any }[]>`
          SELECT package_data FROM custom_invoices WHERE id = ${booking.source_invoice_id}
        `
        if (inv) {
          const packageData = typeof inv.package_data === 'string' ? JSON.parse(inv.package_data) : inv.package_data
          const isSar = packageData?.currencyUnit === 'SAR'
          const rate = Number(packageData?.currency?.sar_to_pkr || 75)
          const convertedAmount = isSar ? amount / rate : amount
          await updateInvoiceReceivedTotals(booking.source_invoice_id, convertedAmount)
        }
      }
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: booking, error: bookingError } = await supabase
        .from('bookings').select('customer_name, total_pkr, paid_pkr, created_by, source_invoice_id').eq('id', bookingId).single()
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

      if (booking.source_invoice_id) {
        const { data: inv } = await supabase
          .from('custom_invoices')
          .select('package_data, received, total')
          .eq('id', booking.source_invoice_id)
          .single()
        if (inv) {
          const packageData = typeof inv.package_data === 'string' ? JSON.parse(inv.package_data) : inv.package_data
          const isSar = packageData?.currencyUnit === 'SAR'
          const rate = Number(packageData?.currency?.sar_to_pkr || 75)
          const convertedAmount = isSar ? amount / rate : amount

          const newReceived = Number(inv.received) + convertedAmount
          const newRemaining = Math.max(0, Number(inv.total) - newReceived)
          await supabase
            .from('custom_invoices')
            .update({ received: newReceived, remaining: newRemaining })
            .eq('id', booking.source_invoice_id)
        }
      }
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

  if (bookingId.startsWith('invoice-')) {
    const invoiceId = bookingId.replace('invoice-', '')
    if (isDemoMode()) {
      const inv = demoStore.customInvoices.find(i => i.id === invoiceId)
      if (!inv) return { error: 'Invoice not found.' }
      if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
        return { error: 'You can only delete your own ledger entries.' }
      }
      demoStore.payments = demoStore.payments.filter(p => (p as any).invoice_id !== invoiceId)
      inv.received = 0
      inv.remaining = inv.total
    } else {
      try {
        if (hasDirectDb()) {
          const sql = requireWriteSql()
          if (!ctx.isAdmin) {
            const [inv] = await sql<{ created_by: string | null }[]>`
              SELECT created_by FROM custom_invoices WHERE id = ${invoiceId}
            `
            if (!inv) return { error: 'Invoice not found.' }
            if (inv.created_by !== ctx.userId) return { error: 'You can only delete your own ledger entries.' }
          }
          await sql`DELETE FROM payments WHERE invoice_id = ${invoiceId}`
          await sql`UPDATE custom_invoices SET received = 0, remaining = total WHERE id = ${invoiceId}`
        } else {
          const { createClient } = await import('@/lib/supabase/server')
          const supabase = await createClient()
          const { data: inv } = await supabase
            .from('custom_invoices')
            .select('total, created_by')
            .eq('id', invoiceId)
            .single()
          if (!inv) return { error: 'Invoice not found.' }
          if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
            return { error: 'You can only delete your own ledger entries.' }
          }
          const { error: payError } = await supabase.from('payments').delete().eq('invoice_id', invoiceId)
          if (payError) return { error: friendlyDbError(payError.message) }
          const { error: invError } = await supabase
            .from('custom_invoices')
            .update({ received: 0, remaining: inv.total })
            .eq('id', invoiceId)
          if (invError) return { error: friendlyDbError(invError.message) }
        }
      } catch (e) {
        return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
      }
    }
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
