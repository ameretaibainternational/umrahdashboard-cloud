import type { CustomInvoice, CustomInvoiceLineItem } from '@/lib/types'

/** Pax per line item; night-mode rows use total_pax for nights, not people. */
function lineItemPax(item: CustomInvoiceLineItem): number {
  if (item.night_price != null) return 0
  const qty = Number(item.total_pax)
  return Number.isFinite(qty) && qty > 0 ? qty : 0
}

/** Standalone custom invoice pax (max across rows — same group on multiple services). */
export function getCustomInvoicePax(invoice: CustomInvoice): number {
  const items = invoice.line_items ?? []
  if (items.length === 0) return 0
  return Math.max(0, ...items.map(lineItemPax))
}
