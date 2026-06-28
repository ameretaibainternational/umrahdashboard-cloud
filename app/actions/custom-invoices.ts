'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadInvoicePdfToStorage } from '@/app/actions/storage'
import { createBooking, updateBooking } from '@/app/actions/bookings'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireAdmin, requireModeratorFeature } from '@/lib/permissions-server'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'
import type { CustomInvoiceLineItem } from '@/lib/types'

const PATHS = ['/custom-invoices', '/settings/invoices', '/settings/storage', '/invoices', '/calculator', '/bookings', '/dashboard', '/accounts', '/reports']

type CustomInvoicePayload = {
  invoice_date: string
  billed_to_name: string
  billed_to_address: string
  billed_to_client_number: string
  payment_bank_name: string
  payment_account_number: string
  terms_text: string
  contact_phone: string
  contact_email: string
  contact_location: string
  line_items: CustomInvoiceLineItem[]
  total: number
  received: number
  remaining: number
  pdf_base64: string
}

async function buildBookingPayloadFromInvoice(
  invoiceId: string,
  payload: Omit<CustomInvoicePayload, 'pdf_base64'>,
  existingPaidPkr = 0,
) {
  const cost_pkr = Math.max(0, payload.total - payload.received)
  const paid_pkr = Math.max(existingPaidPkr, payload.received)
  return {
    customer_name: payload.billed_to_name,
    airline_name: '',
    total_pkr: payload.total,
    cost_pkr,
    profit_pkr: payload.total - cost_pkr,
    advance_pkr: payload.received,
    paid_pkr,
    remaining_pkr: Math.max(0, payload.total - paid_pkr),
    adult_count: 0,
    child_count: 0,
    infant_count: 0,
    makkah_hotel_name: null,
    makkah_hotel_location: null,
    makkah_hotel_distance: null,
    makkah_room_type: null,
    makkah_nights: null,
    madinah_hotel_name: null,
    madinah_hotel_location: null,
    madinah_hotel_distance: null,
    madinah_room_type: null,
    madinah_nights: null,
    booking_date: payload.invoice_date,
    source_invoice_id: invoiceId,
  }
}

async function createBookingFromInvoice(invoiceId: string, payload: Omit<CustomInvoicePayload, 'pdf_base64'>) {
  await createBooking(await buildBookingPayloadFromInvoice(invoiceId, payload))
}

async function syncBookingFromInvoice(
  invoiceId: string,
  payload: Omit<CustomInvoicePayload, 'pdf_base64'>,
  previous: { billed_to_name: string; invoice_date: string; total: number },
) {
  const { findBookingForCustomInvoice, linkBookingToInvoice } = await import('@/lib/db')
  const linked = await findBookingForCustomInvoice(invoiceId, {
    customer_name: previous.billed_to_name,
    booking_date: previous.invoice_date,
    total_pkr: previous.total,
  })

  const bookingPayload = await buildBookingPayloadFromInvoice(invoiceId, payload, linked?.paid_pkr ?? 0)
  const { source_invoice_id: _, ...updatePayload } = bookingPayload

  if (linked) {
    if (!linked.source_invoice_id) {
      await linkBookingToInvoice(linked.id, invoiceId)
    }
    await updateBooking(linked.id, updatePayload)
    return
  }

  await createBooking(bookingPayload)
}

export async function createCustomInvoiceWithPdf(payload: CustomInvoicePayload) {
  const ctx = await requireModeratorFeature('custom_invoices')
  if ('error' in ctx) return ctx

  const id = crypto.randomUUID()
  const upload = await uploadInvoicePdfToStorage(id, payload.pdf_base64)
  if ('error' in upload) return { error: upload.error }

  const { pdf_base64: _, ...invoicePayload } = payload

  if (isDemoMode()) {
    const inv = demoStore.addCustomInvoice({
      id,
      ...invoicePayload,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      file_deleted_at: null,
      created_by: ctx.userId,
    })
    await createBookingFromInvoice(id, invoicePayload)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: inv.invoice_number, id: inv.id }
  }

  const row = {
    id,
    ...invoicePayload,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
    created_by: ctx.userId,
  }

  try {
    if (hasDirectDb()) {
      try {
        const { insertCustomInvoiceDirect } = await import('@/lib/document-db')
        const data = await insertCustomInvoiceDirect(row)
        await createBookingFromInvoice(id, invoicePayload)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const, invoice_number: data.invoice_number, id: data.id }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { insertCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
    const data = await insertCustomInvoiceSupabase(row)
    await createBookingFromInvoice(id, invoicePayload)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: data.invoice_number, id: data.id }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }
}

export async function updateCustomInvoiceWithPdf(payload: CustomInvoicePayload & { id: string; invoice_number: string }) {
  const ctx = await requireModeratorFeature('custom_invoices')
  if ('error' in ctx) return ctx

  const { getCustomInvoiceById } = await import('@/lib/db')
  const existing = await getCustomInvoiceById(payload.id)
  if (!existing) return { error: 'Invoice not found.' }
  if (!ctx.isAdmin && existing.created_by !== ctx.userId) {
    return { error: 'You can only edit your own invoices.' }
  }

  const upload = await uploadInvoicePdfToStorage(payload.id, payload.pdf_base64)
  if ('error' in upload) return { error: upload.error }

  const { pdf_base64: _, id, invoice_number, ...invoiceFields } = payload
  const row = {
    id,
    invoice_number,
    ...invoiceFields,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
  }

  if (isDemoMode()) {
    demoStore.updateCustomInvoice(payload.id, row)
    await syncBookingFromInvoice(payload.id, invoiceFields, existing)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
  }

  try {
    if (hasDirectDb()) {
      try {
        const { updateCustomInvoiceDirect } = await import('@/lib/document-db')
        await updateCustomInvoiceDirect(row)
        await syncBookingFromInvoice(payload.id, invoiceFields, existing)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { updateCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
    await updateCustomInvoiceSupabase(row)
    await syncBookingFromInvoice(payload.id, invoiceFields, existing)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Update failed') }
  }
}

export async function deleteCustomInvoice(id: string) {
  const ctx = await requireModeratorFeature('custom_invoices')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    const inv = demoStore.customInvoices.find(i => i.id === id)
    if (!inv) return { error: 'Invoice not found.' }
    if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
      return { error: 'You can only delete your own invoices.' }
    }
    demoStore.deleteCustomInvoice(id)
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!ctx.isAdmin) {
      const { data: inv } = await supabase.from('custom_invoices').select('created_by').eq('id', id).single()
      if (!inv) return { error: 'Invoice not found.' }
      if (inv.created_by !== ctx.userId) return { error: 'You can only delete your own invoices.' }
    }

    try {
      if (hasDirectDb()) {
        try {
          const { deleteCustomInvoiceDirect } = await import('@/lib/document-db')
          await deleteCustomInvoiceDirect(id)
        } catch (error) {
          if (!isDirectDbRecoverableError(error)) throw error
          markDirectDbAuthFailed()
          const { deleteCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
          await deleteCustomInvoiceSupabase(id)
        }
      } else {
        const { deleteCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
        await deleteCustomInvoiceSupabase(id)
      }
      const { syncStorageUsageSupabase } = await import('@/lib/supabase-document-db')
      const { fetchStoredFilesSupabase } = await import('@/lib/supabase-document-db')
      const { storageUsageFromFiles } = await import('@/lib/storage-usage')
      const files = await fetchStoredFilesSupabase()
      await syncStorageUsageSupabase(storageUsageFromFiles(files).total_bytes)
    } catch (e) {
      return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
    }
  }
  PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function saveInvoiceSettings(payload: {
  payment_bank_name: string
  payment_account_number: string
  terms_text: string
  contact_phone: string
  contact_email: string
  contact_location: string
}) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    demoStore.updateInvoiceSettings(payload)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: existing } = await supabase.from('invoice_settings').select('id').maybeSingle()
  if (existing?.id) {
    await supabase.from('invoice_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await supabase.from('invoice_settings').insert(payload)
  }
  PATHS.forEach(p => revalidatePath(p))
  return { success: true as const }
}

/** @deprecated Use createCustomInvoiceWithPdf — kept for backwards compatibility */
export async function createCustomInvoice(payload: Parameters<typeof createCustomInvoiceWithPdf>[0] & { pdf_base64?: string }) {
  if (!payload.pdf_base64) return { error: 'PDF is required. Use createCustomInvoiceWithPdf.' }
  return createCustomInvoiceWithPdf(payload as Parameters<typeof createCustomInvoiceWithPdf>[0])
}
