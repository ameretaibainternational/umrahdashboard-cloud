'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadVoucherPdfToStorage } from '@/app/actions/storage'
import { friendlyDbError } from '@/lib/friendly-db-error'
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
