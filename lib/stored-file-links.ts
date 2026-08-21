import type { StoredFileType } from '@/lib/types'

export function storedFileEditHref(
  type: StoredFileType,
  id: string,
  invoiceKind?: 'custom' | 'package' | null,
): string {
  if (type === 'voucher') return `/hotel-voucher?edit=${encodeURIComponent(id)}`
  if (type === 'poster') return `/umrah-poster?edit=${encodeURIComponent(id)}`
  if (invoiceKind === 'package') return `/calculator?edit=${encodeURIComponent(id)}`
  return `/custom-invoices?edit=${encodeURIComponent(id)}`
}
