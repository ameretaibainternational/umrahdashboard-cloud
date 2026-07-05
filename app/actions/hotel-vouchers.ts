'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadVoucherPdfToStorage } from '@/app/actions/storage'
import { friendlyDbError } from '@/lib/friendly-db-error'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'
import { requireModeratorFeature } from '@/lib/permissions-server'
import type { VoucherData } from '@/components/hotel-voucher/HotelVoucherTemplate'

const PATHS = ['/hotel-voucher', '/settings/storage']

export async function createHotelVoucherWithPdf(payload: {
  voucher_date: string
  reference_no: string
  family_head: string
  package_info: string
  voucher_data: VoucherData
  pdf_base64: string
}) {
  const ctx = await requireModeratorFeature('hotel_vouchers')
  if ('error' in ctx) return ctx

  const id = crypto.randomUUID()
  const upload = await uploadVoucherPdfToStorage(id, payload.pdf_base64)
  if ('error' in upload) return { error: upload.error }

  const row = {
    id,
    voucher_date: payload.voucher_date,
    reference_no: payload.reference_no,
    family_head: payload.family_head,
    package_info: payload.package_info,
    voucher_data: payload.voucher_data,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
  }

  if (isDemoMode()) {
    const voucher = demoStore.addHotelVoucher({
      id,
      voucher_date: row.voucher_date,
      reference_no: row.reference_no,
      family_head: row.family_head,
      package_info: row.package_info,
      voucher_data: row.voucher_data as unknown as Record<string, unknown>,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      file_deleted_at: null,
      created_by: ctx.userId,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, id: voucher.id, voucher_number: voucher.voucher_number }
  }

  try {
    const { insertHotelVoucher } = await import('@/lib/document-db')
    const data = await insertHotelVoucher({
      id,
      voucher_date: row.voucher_date,
      reference_no: row.reference_no,
      family_head: row.family_head,
      package_info: row.package_info,
      voucher_data: row.voucher_data as unknown as Record<string, unknown>,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      created_by: ctx.userId,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, id: data.id, voucher_number: data.voucher_number }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }
}

export async function updateHotelVoucherWithPdf(payload: {
  id: string
  voucher_date: string
  reference_no: string
  family_head: string
  package_info: string
  voucher_data: VoucherData
  pdf_base64: string
}) {
  const ctx = await requireModeratorFeature('hotel_vouchers')
  if ('error' in ctx) return ctx

  const upload = await uploadVoucherPdfToStorage(payload.id, payload.pdf_base64)
  if ('error' in upload) return { error: upload.error }

  const row = {
    voucher_date: payload.voucher_date,
    reference_no: payload.reference_no,
    family_head: payload.family_head,
    package_info: payload.package_info,
    voucher_data: payload.voucher_data as unknown as Record<string, unknown>,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
  }

  if (isDemoMode()) {
    demoStore.updateHotelVoucher(payload.id, {
      ...row,
      voucher_data: row.voucher_data as unknown as Record<string, unknown>,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const }
  }

  try {
    if (hasDirectDb()) {
      try {
        const { updateHotelVoucherDirect } = await import('@/lib/document-db')
        await updateHotelVoucherDirect(payload.id, row)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
        const { updateHotelVoucherSupabase } = await import('@/lib/supabase-document-db')
        await updateHotelVoucherSupabase(payload.id, row)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const }
      }
    } else {
      const { updateHotelVoucherSupabase } = await import('@/lib/supabase-document-db')
      await updateHotelVoucherSupabase(payload.id, row)
      PATHS.forEach(p => revalidatePath(p))
      return { success: true as const }
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Update failed') }
  }
}

export async function deleteHotelVoucher(id: string) {
  const ctx = await requireModeratorFeature('hotel_vouchers')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    demoStore.deleteHotelVoucher(id)
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!ctx.isAdmin) {
      const { data: v } = await supabase.from('hotel_vouchers').select('created_by').eq('id', id).single()
      if (!v) return { error: 'Voucher not found.' }
      if (v.created_by !== ctx.userId) return { error: 'You can only delete your own vouchers.' }
    }

    try {
      if (hasDirectDb()) {
        try {
          const { deleteHotelVoucherDirect } = await import('@/lib/document-db')
          await deleteHotelVoucherDirect(id)
        } catch (error) {
          if (!isDirectDbRecoverableError(error)) throw error
          markDirectDbAuthFailed()
          const { deleteHotelVoucherSupabase } = await import('@/lib/supabase-document-db')
          await deleteHotelVoucherSupabase(id)
        }
      } else {
        const { deleteHotelVoucherSupabase } = await import('@/lib/supabase-document-db')
        await deleteHotelVoucherSupabase(id)
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

export async function deleteHotelVouchers(ids: string[]) {
  if (ids.length === 0) return { error: 'No vouchers selected.' }

  const uniqueIds = [...new Set(ids)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteHotelVoucher(id)
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


