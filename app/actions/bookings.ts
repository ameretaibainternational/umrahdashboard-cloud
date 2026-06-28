'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireModeratorFeature } from '@/lib/permissions-server'
import { supabaseInsertRow } from '@/lib/supabase-fallback-insert'
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
}

const REVALIDATE_PATHS = ['/bookings', '/dashboard', '/accounts', '/reports', '/customers', '/invoices']

export async function createBooking(payload: BookingPayload) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    demoStore.addBooking({
      ...payload,
      booking_date: payload.booking_date ?? new Date().toISOString().split('T')[0],
      created_by: ctx.userId,
    })
    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  }

  const bookingDate = payload.booking_date ?? new Date().toISOString().split('T')[0]
  const { source_invoice_id, ...bookingFields } = payload
  const row: Record<string, unknown> = { ...bookingFields, booking_date: bookingDate }
  if (source_invoice_id) row.source_invoice_id = source_invoice_id

  try {
    if (hasDirectDb()) {
      try {
        const { insertBooking } = await import('@/lib/crm-db')
        await insertBooking({ ...row, created_by: ctx.userId } as Parameters<typeof insertBooking>[0])
        REVALIDATE_PATHS.forEach(p => revalidatePath(p))
        return { success: true }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    let { error } = await supabaseInsertRow('bookings', row, ctx.userId)
    if (error && source_invoice_id && (error.includes('source_invoice_id') || error.includes('schema cache'))) {
      const { source_invoice_id: _, ...withoutLink } = row
      ;({ error } = await supabaseInsertRow('bookings', withoutLink, ctx.userId))
    }
    if (error) return { error: friendlyDbError(error) }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }

  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteBooking(id: string) {
  const ctx = await requireModeratorFeature('bookings')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === id)
    if (!booking) return { error: 'Booking not found.' }
    if (!ctx.isAdmin && booking.created_by !== ctx.userId) {
      return { error: 'You can only delete your own bookings.' }
    }
    demoStore.deleteBooking(id)
  } else {
    try {
      if (hasDirectDb()) {
        try {
          const { deleteBookingById, getBookingOwner } = await import('@/lib/crm-db')
          if (!ctx.isAdmin) {
            const owner = await getBookingOwner(id)
            if (owner === undefined) return { error: 'Booking not found.' }
            if (owner !== ctx.userId) return { error: 'You can only delete your own bookings.' }
          }
          await deleteBookingById(id)
        } catch (error) {
          if (!isDirectDbRecoverableError(error)) throw error
          markDirectDbAuthFailed()
          const { createClient } = await import('@/lib/supabase/server')
          const supabase = await createClient()
          if (!ctx.isAdmin) {
            const { data: booking } = await supabase.from('bookings').select('created_by').eq('id', id).single()
            if (!booking) return { error: 'Booking not found.' }
            if (booking.created_by !== ctx.userId) return { error: 'You can only delete your own bookings.' }
          }
          await supabase.from('bookings').delete().eq('id', id)
        }
      } else {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        if (!ctx.isAdmin) {
          const { data: booking } = await supabase.from('bookings').select('created_by').eq('id', id).single()
          if (!booking) return { error: 'Booking not found.' }
          if (booking.created_by !== ctx.userId) return { error: 'You can only delete your own bookings.' }
        }
        await supabase.from('bookings').delete().eq('id', id)
      }
    } catch (e) {
      return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
    }
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
