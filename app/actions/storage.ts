'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadPdf, deletePdfKeys, isR2Configured } from '@/lib/r2'
import type { StoredFileType } from '@/lib/types'

const PATHS = ['/settings/storage', '/custom-invoices', '/hotel-voucher']

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

async function requireStorageAccess() {
  const { requireAdmin } = await import('@/lib/permissions-server')
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx
  return null
}

export async function softDeleteStoredFiles(items: { id: string; type: StoredFileType }[]) {
  const guard = await requireStorageAccess()
  if (guard) return guard
  if (items.length === 0) return { error: 'No files selected.' }

  const keys: string[] = []
  const now = new Date().toISOString()

  if (isDemoMode()) {
    for (const item of items) {
      if (item.type === 'invoice') demoStore.softDeleteInvoiceFile(item.id)
      else demoStore.softDeleteVoucherFile(item.id)
    }
  } else {
    const { softDeleteFileRow, markFileDeleted } = await import('@/lib/document-db')
    for (const item of items) {
      const row = await softDeleteFileRow(item.id, item.type)
      if (!row?.storage_key || row.file_deleted_at) continue
      keys.push(row.storage_key)
      await markFileDeleted(item.id, item.type, now)
    }
    if (keys.length > 0) await deletePdfKeys(keys)
  }

  PATHS.forEach(p => revalidatePath(p))
  return { success: true as const, deleted: items.length }
}

export async function uploadInvoicePdfToStorage(id: string, pdfBase64: string): Promise<{ storage_key: string; file_size_bytes: number } | { error: string }> {
  if (!isR2Configured()) return { error: 'File storage is not configured. Add R2 credentials to .env.local.' }
  try {
    const buffer = Buffer.from(pdfBase64, 'base64')
    const storage_key = `invoices/${id}.pdf`
    await uploadPdf(storage_key, buffer)
    return { storage_key, file_size_bytes: buffer.length }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed' }
  }
}

export async function uploadVoucherPdfToStorage(id: string, pdfBase64: string): Promise<{ storage_key: string; file_size_bytes: number } | { error: string }> {
  if (!isR2Configured()) return { error: 'File storage is not configured. Add R2 credentials to .env.local.' }
  try {
    const buffer = Buffer.from(pdfBase64, 'base64')
    const storage_key = `vouchers/${id}.pdf`
    await uploadPdf(storage_key, buffer)
    return { storage_key, file_size_bytes: buffer.length }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed' }
  }
}
