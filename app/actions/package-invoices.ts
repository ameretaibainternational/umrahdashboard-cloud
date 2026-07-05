'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadInvoicePdfToStorage } from '@/app/actions/storage'
import { friendlyDbError } from '@/lib/friendly-db-error'
import { requireModeratorFeature } from '@/lib/permissions-server'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'
import type { PackageInvoiceData } from '@/lib/types'

const PATHS = ['/invoices', '/calculator', '/custom-invoices', '/settings/storage']

type PackageInvoicePayload = {
  invoice_number: string
  invoice_date: string
  billed_to_name: string
  billed_to_address?: string
  billed_to_client_number?: string
  total: number
  received: number
  remaining: number
  package_data: PackageInvoiceData
  pdf_base64: string
  contact_phone?: string
  contact_email?: string
  contact_location?: string
  invoice_title_text?: string
}

async function persistPackageInvoice(
  id: string,
  payload: PackageInvoicePayload,
  userId: string,
  mode: 'create' | 'update',
) {
  const upload = await uploadInvoicePdfToStorage(id, payload.pdf_base64)
  if ('error' in upload) return { error: upload.error }

  const { pdf_base64: _, ...fields } = payload
  const row = {
    id,
    ...fields,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
    created_by: userId,
  }

  if (isDemoMode()) {
    if (mode === 'create') {
      const inv = demoStore.addCustomInvoice({
        ...row,
        billed_to_address: payload.billed_to_address ?? '',
        billed_to_client_number: payload.billed_to_client_number ?? '',
        payment_bank_name: '',
        payment_account_number: '',
        terms_text: '',
        contact_phone: row.contact_phone ?? '',
        contact_email: row.contact_email ?? '',
        contact_location: row.contact_location ?? '',
        line_items: [],
        file_deleted_at: null,
        invoice_kind: 'package',
        package_data: payload.package_data,
      })
      PATHS.forEach(p => revalidatePath(p))
      return { success: true as const, invoice_number: inv.invoice_number, id: inv.id }
    }
    const inv = demoStore.customInvoices.find(i => i.id === id)
    if (!inv) return { error: 'Invoice not found.' }
    Object.assign(inv, {
      ...fields,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      invoice_kind: 'package',
      package_data: payload.package_data,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: inv.invoice_number, id: inv.id }
  }

  try {
    if (hasDirectDb()) {
      try {
        const { insertPackageInvoiceDirect, updatePackageInvoiceDirect } = await import('@/lib/document-db')
        const data = mode === 'create'
          ? await insertPackageInvoiceDirect(row)
          : await updatePackageInvoiceDirect(row)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const, invoice_number: data.invoice_number, id: data.id }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
      }
    }

    const { insertPackageInvoiceSupabase, updatePackageInvoiceSupabase } = await import('@/lib/supabase-document-db')
    const data = mode === 'create'
      ? await insertPackageInvoiceSupabase(row)
      : await updatePackageInvoiceSupabase(row)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, invoice_number: data.invoice_number, id: data.id }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }
}

export async function createPackageInvoiceWithPdf(payload: PackageInvoicePayload) {
  const ctx = await requireModeratorFeature('calculator')
  if ('error' in ctx) return ctx
  return persistPackageInvoice(crypto.randomUUID(), payload, ctx.userId, 'create')
}

export async function updatePackageInvoiceWithPdf(payload: PackageInvoicePayload & { id: string }) {
  const ctx = await requireModeratorFeature('calculator')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    const inv = demoStore.customInvoices.find(i => i.id === payload.id)
    if (!inv) return { error: 'Invoice not found.' }
    if (!ctx.isAdmin && inv.created_by !== ctx.userId) {
      return { error: 'You can only edit your own invoices.' }
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!ctx.isAdmin) {
      const { data: inv } = await supabase.from('custom_invoices').select('created_by').eq('id', payload.id).single()
      if (!inv) return { error: 'Invoice not found.' }
      if (inv.created_by !== ctx.userId) return { error: 'You can only edit your own invoices.' }
    }
  }

  const { id, ...rest } = payload
  return persistPackageInvoice(id, rest, ctx.userId, 'update')
}
