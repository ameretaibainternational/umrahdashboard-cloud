import type { CustomInvoice, CustomInvoiceLineItem } from '@/lib/types'

/** Pax per line item — always uses total_pax (people count). */
function lineItemPax(item: CustomInvoiceLineItem): number {
  const qty = Number(item.total_pax)
  return Number.isFinite(qty) && qty > 0 ? qty : 0
}

/** Standalone custom invoice pax (max across rows — same group on multiple services). */
export function getCustomInvoicePax(invoice: CustomInvoice): number {
  const items = invoice.line_items ?? []
  if (items.length === 0) return 0
  return Math.max(0, ...items.map(lineItemPax))
}
