'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { recordPackageExpense } from '@/lib/package-expense'
import { recordInitialBookingPayment } from '@/lib/booking-payment'
import { requireModeratorFeature } from '@/lib/permissions-server'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'

type BookingPayload = {
  customer_name: string; airline_name: string
  total_pkr: number; cost_pkr: number; profit_pkr: number
  advance_pkr: number; paid_pkr: number; remaining_pkr: number
  adult_count: number; child_count: number; infant_count: number
  makkah_hotel_name: string | null; makkah_hotel_location: string | null
  makkah_hotel_distance: string | null; makkah_room_type: string | null; makkah_nights: number | null
  madinah_hotel_name: string | null; madinah_hotel_location: string | null
  madinah_hotel_distance: string | null;   madinah_room_type: string | null; madinah_nights: number | null
  booking_date?: string
  source_invoice_id?: string | null
  auto_record_expense?: boolean
}

const REVALIDATE_PATHS = ['/bookings', '/dashboard', '/accounts', '/reports', '/customers', '/invoices']

async function insertBookingWithExpense(
  payload: BookingPayload,
  userId: string,
): Promise<{ error?: string }> {
  const bookingDate = payload.booking_date ?? new Date().toISOString().split('T')[0]
  const isFinalized = Boolean(payload.source_invoice_id)
  const shouldRecordExpense = payload.auto_record_expense === true && isFinalized
  const shouldRecordPayment = isFinalized

  const expenseInput = {
    customer_name: payload.customer_name,
    cost_pkr: payload.cost_pkr,
    total_pkr: payload.total_pkr,
    profit_pkr: payload.profit_pkr,
    booking_date: bookingDate,
    created_by: userId,
  }

  if (isDemoMode()) {
    const { auto_record_expense: __, source_invoice_id, ...bookingPayload } = payload
    const booking = demoStore.addBooking({
      ...bookingPayload,
      booking_date: bookingDate,
      created_by: userId,
      source_invoice_id: source_invoice_id ?? null,
    })
    if (shouldRecordExpense) {
      await recordPackageExpense({ ...expenseInput, booking_id: booking.id })
    }
    if (shouldRecordPayment) {
      await recordInitialBookingPayment(booking.id, {
        customer_name: payload.customer_name,
        advance_pkr: payload.advance_pkr,
        booking_date: bookingDate,
      }, userId)
    }
    return {}
  }

  const { source_invoice_id, auto_record_expense: _, ...bookingFields } = payload
  const row: Record<string, unknown> = { ...bookingFields, booking_date: bookingDate }
  if (source_invoice_id) row.source_invoice_id = source_invoice_id

  let bookingId: string | null = null

  if (hasDirectDb()) {
    try {
      const { insertBooking } = await import('@/lib/crm-db')
      bookingId = await insertBooking({ ...row, created_by: userId } as Parameters<typeof insertBooking>[0])
    } catch (error) {
      if (!isDirectDbRecoverableError(error)) throw error
      markDirectDbAuthFailed()
    }
  }

  if (!bookingId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const withOwner: Record<string, unknown> = { ...row, created_by: userId }
    let { data, error } = await supabase.from('bookings').insert(withOwner).select('id').single()

    if (error && source_invoice_id && (error.message.includes('source_invoice_id') || error.message.includes('schema cache'))) {
      const withoutLink = { ...withOwner }
      delete withoutLink.source_invoice_id
      ;({ data, error } = await supabase.from('bookings').insert(withoutLink).select('id').single())
    }

    if (error || !data?.id) {
      return { error: friendlyDbError(error?.message ?? 'Save failed') }
    }

    bookingId = data.id
  }

  if (shouldRecordExpense) {
    await recordPackageExpense({ ...expenseInput, booking_id: bookingId })
  }
  if (bookingId && shouldRecordPayment) {
    await recordInitialBookingPayment(bookingId, {
      customer_name: payload.customer_name,
      advance_pkr: payload.advance_pkr,
      booking_date: bookingDate,
    }, userId)
  }
  return {}
}

export async function createBooking(payload: BookingPayload) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  try {
    const result = await insertBookingWithExpense(payload, ctx.userId)
    if (result.error) return { error: result.error }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }

  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteBooking(id: string) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  let sourceInvoiceId: string | null = null
  let createdBy: string | null = null
  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === id)
    if (booking) {
      sourceInvoiceId = booking.source_invoice_id ?? null
      createdBy = booking.created_by ?? null
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: booking } = await supabase.from('bookings').select('source_invoice_id, created_by').eq('id', id).single()
    if (booking) {
      sourceInvoiceId = booking.source_invoice_id ?? null
      createdBy = booking.created_by ?? null
    }
  }

  if (!ctx.isAdmin && createdBy && createdBy !== ctx.userId) {
    return { error: 'You can only delete your own bookings.' }
  }

  if (isDemoMode()) {
    demoStore.deleteBooking(id)
  } else {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      if (hasDirectDb()) {
        try {
          const { deleteBookingById } = await import('@/lib/crm-db')
          await deleteBookingById(id)
        } catch (error) {
          if (!isDirectDbRecoverableError(error)) throw error
          markDirectDbAuthFailed()
          await supabase.from('bookings').delete().eq('id', id)
        }
      } else {
        await supabase.from('bookings').delete().eq('id', id)
      }
    } catch (e) {
      return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
    }
  }

  if (sourceInvoiceId) {
    const { deleteCustomInvoice } = await import('@/app/actions/custom-invoices')
    await deleteCustomInvoice(sourceInvoiceId)
  }

  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteBookings(ids: string[]) {
  if (ids.length === 0) return { error: 'No bookings selected.' }

  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  const uniqueIds = [...new Set(ids)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteBooking(id)
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

export async function updateBooking(id: string, payload: BookingPayload) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  const profit_pkr = payload.total_pkr - payload.cost_pkr
  const remaining_pkr = Math.max(0, payload.total_pkr - payload.paid_pkr)
  const row = {
    ...payload,
    profit_pkr,
    remaining_pkr,
    booking_date: payload.booking_date ?? new Date().toISOString().split('T')[0],
  }

  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === id)
    if (!booking) return { error: 'Booking not found.' }
    if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
      return { error: 'You can only edit your own bookings.' }
    }
    demoStore.updateBooking(id, row)
    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true as const }
  }

  try {
    if (hasDirectDb()) {
      try {
        if (!ctx.isAdmin) {
          const { getBookingOwner } = await import('@/lib/crm-db')
          const owner = await getBookingOwner(id)
          if (owner === undefined) return { error: 'Booking not found.' }
          if (owner !== ctx.userId) return { error: 'You can only edit your own bookings.' }
        }
        const { updateBookingById } = await import('@/lib/crm-db')
        await updateBookingById(id, row)
        REVALIDATE_PATHS.forEach(p => revalidatePath(p))
        return { success: true as const }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!ctx.isAdmin) {
      const { data: booking } = await supabase.from('bookings').select('created_by').eq('id', id).single()
      if (!booking) return { error: 'Booking not found.' }
      if (booking.created_by !== ctx.userId) return { error: 'You can only edit your own bookings.' }
    }
    const { error } = await supabase.from('bookings').update(row).eq('id', id)
    if (error) return { error: friendlyDbError(error.message) }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Update failed') }
  }

  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true as const }
}

export async function finalizeBookingWithInvoice(bookingId: string, invoiceId: string) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  let booking: any = null
  if (isDemoMode()) {
    booking = demoStore.bookings.find(b => b.id === bookingId)
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase.from('bookings').select('*').eq('id', bookingId).single()
    booking = data
  }

  if (!booking) return { error: 'Booking not found.' }

  if (isDemoMode()) {
    booking.source_invoice_id = invoiceId
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('bookings').update({ source_invoice_id: invoiceId }).eq('id', bookingId)
  }

  const expenseInput = {
    customer_name: booking.customer_name,
    cost_pkr: booking.cost_pkr,
    total_pkr: booking.total_pkr,
    profit_pkr: booking.profit_pkr,
    booking_date: booking.booking_date,
    created_by: ctx.userId,
  }

  await recordPackageExpense({ ...expenseInput, booking_id: bookingId })
  await recordInitialBookingPayment(bookingId, {
    customer_name: booking.customer_name,
    advance_pkr: booking.advance_pkr,
    booking_date: booking.booking_date,
  }, ctx.userId)

  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true as const }
}
