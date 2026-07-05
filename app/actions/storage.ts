'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadPdf, deletePdfKeys, isR2Configured, listStoredPdfKeys } from '@/lib/r2'
import { hasDirectDb, isDirectDbRecoverableError, markDirectDbAuthFailed } from '@/lib/sql'
import type { StoredFileType } from '@/lib/types'

const PATHS = ['/settings/storage', '/custom-invoices', '/hotel-voucher', '/invoices', '/calculator']

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

/** Remove orphaned R2 PDFs and reset the usage counter from active files. */
export async function reconcileStorageUsage() {
  const guard = await requireStorageAccess()
  if (guard) return guard
  if (!isR2Configured()) return { error: 'File storage is not configured.' }

  let activeKeys: Set<string>
  if (isDemoMode()) {
    activeKeys = new Set(
      [...demoStore.customInvoices, ...demoStore.hotelVouchers]
        .filter(r => !r.file_deleted_at && r.storage_key)
        .map(r => r.storage_key!),
    )
  } else {
    const fetchActive = async () => {
      const { fetchActiveStorageKeysSupabase } = await import('@/lib/supabase-document-db')
      return fetchActiveStorageKeysSupabase()
    }
    let keys: string[]
    if (hasDirectDb()) {
      try {
        const { fetchActiveStorageKeys } = await import('@/lib/document-db')
        keys = await fetchActiveStorageKeys()
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
        keys = await fetchActive()
      }
    } else {
      keys = await fetchActive()
    }
    activeKeys = new Set(keys)
  }

  const r2Keys = await listStoredPdfKeys()
  const orphanKeys = r2Keys.filter(key => !activeKeys.has(key))
  if (orphanKeys.length > 0) await deletePdfKeys(orphanKeys)

  let total_bytes = 0
  if (isDemoMode()) {
    for (const inv of demoStore.customInvoices) {
      if (!inv.file_deleted_at && inv.file_size_bytes) total_bytes += inv.file_size_bytes
    }
    for (const v of demoStore.hotelVouchers) {
      if (!v.file_deleted_at && v.file_size_bytes) total_bytes += v.file_size_bytes
    }
    demoStore.setStorageUsage(total_bytes)
  } else {
    const { fetchStorageUsageSupabase } = await import('@/lib/supabase-document-db')
    const usage = await fetchStorageUsageSupabase()
    total_bytes = usage.total_bytes
  }

  PATHS.forEach(p => revalidatePath(p))
  return {
    success: true as const,
    removed: orphanKeys.length,
    total_bytes,
  }
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
