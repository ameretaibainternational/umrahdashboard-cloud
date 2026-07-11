'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadInvoicePdfToStorage } from '@/app/actions/storage'
import { deleteBooking } from '@/app/actions/bookings'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireAdmin, requireModeratorFeature } from '@/lib/permissions-server'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'
import { recordCustomInvoiceExpense, deleteCustomInvoiceExpense } from '@/lib/custom-invoice-expense'
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
  profit_pkr: number
  pdf_base64: string
  invoice_number?: string
  invoice_title_text?: string
  package_data?: any
}

async function cleanupLegacyCustomBooking(
  invoiceId: string,
  snapshot: { billed_to_name: string; invoice_date: string; total: number },
) {
  const { findBookingForCustomInvoice } = await import('@/lib/db')
  const linked = await findBookingForCustomInvoice(invoiceId, {
    customer_name: snapshot.billed_to_name,
    booking_date: snapshot.invoice_date,
    total_pkr: snapshot.total,
  })
  if (linked) await deleteBooking(linked.id)
}

async function syncCustomInvoiceFinancials(
  invoiceId: string,
  invoiceNumber: string,
  payload: Omit<CustomInvoicePayload, 'pdf_base64'>,
  createdBy: string,
) {
  await recordCustomInvoiceExpense({
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    customer_name: payload.billed_to_name,
    total_pkr: payload.total,
    profit_pkr: payload.profit_pkr,
    invoice_date: payload.invoice_date,
    created_by: createdBy,
  })
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
    await syncCustomInvoiceFinancials(id, inv.invoice_number, invoicePayload, ctx.userId)
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
        await syncCustomInvoiceFinancials(id, data.invoice_number, invoicePayload, ctx.userId)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const, invoice_number: data.invoice_number, id: data.id }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { insertCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
    const data = await insertCustomInvoiceSupabase(row)
    await syncCustomInvoiceFinancials(id, data.invoice_number, invoicePayload, ctx.userId)
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
    await cleanupLegacyCustomBooking(payload.id, existing)
    await syncCustomInvoiceFinancials(payload.id, payload.invoice_number, invoiceFields, ctx.userId)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
  }

  try {
    if (hasDirectDb()) {
      try {
        const { updateCustomInvoiceDirect } = await import('@/lib/document-db')
        await updateCustomInvoiceDirect(row)
        await cleanupLegacyCustomBooking(payload.id, existing)
        await syncCustomInvoiceFinancials(payload.id, payload.invoice_number, invoiceFields, ctx.userId)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { updateCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
    await updateCustomInvoiceSupabase(row)
    await cleanupLegacyCustomBooking(payload.id, existing)
    await syncCustomInvoiceFinancials(payload.id, payload.invoice_number, invoiceFields, ctx.userId)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: payload.invoice_number, id: payload.id }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Update failed') }
  }
}

export async function deleteCustomInvoice(id: string) {
  const ctx = await requireModeratorFeature('custom_invoices')
  if ('error' in ctx) return ctx

  const { getCustomInvoiceById } = await import('@/lib/db')
  const existing = await getCustomInvoiceById(id)

  if (isDemoMode()) {
    const inv = demoStore.customInvoices.find(i => i.id === id)
    if (!inv) return { error: 'Invoice not found.' }
    if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
      return { error: 'You can only delete your own invoices.' }
    }
    if (existing) {
      await cleanupLegacyCustomBooking(id, existing)
    }
    await deleteCustomInvoiceExpense(id)
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
      if (existing) {
        await cleanupLegacyCustomBooking(id, existing)
      }
      await deleteCustomInvoiceExpense(id)

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

export async function deleteCustomInvoices(ids: string[]) {
  if (ids.length === 0) return { error: 'No invoices selected.' }

  const uniqueIds = [...new Set(ids)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteCustomInvoice(id)
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
