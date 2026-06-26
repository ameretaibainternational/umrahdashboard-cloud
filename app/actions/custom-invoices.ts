'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadInvoicePdfToStorage } from '@/app/actions/storage'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireAdmin, requireModeratorFeature } from '@/lib/permissions-server'
import type { CustomInvoiceLineItem } from '@/lib/types'

const PATHS = ['/custom-invoices', '/settings/invoices', '/settings/storage']

export async function createCustomInvoiceWithPdf(payload: {
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
}) {
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
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: inv.invoice_number, id: inv.id }
  }

  try {
    const { insertCustomInvoice } = await import('@/lib/document-db')
    const data = await insertCustomInvoice({
      id,
      ...invoicePayload,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      created_by: ctx.userId,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: data.invoice_number, id: data.id }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
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
    await supabase.from('custom_invoices').delete().eq('id', id)
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
