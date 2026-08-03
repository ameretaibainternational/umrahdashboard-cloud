/** Normalize customer/supplier name for ledger grouping (case-insensitive, strip invoice suffix). */
export function ledgerCustomerKey(name: string): string {
  return ledgerDisplayName(name).toLowerCase()
}

/** Prefer the plain customer name without "(Invoice: …)" suffix. */
export function ledgerDisplayName(name: string): string {
  return name.replace(/\s*\(Invoice:\s*[^)]+\)\s*$/i, '').trim() || name.trim()
}

export function formatLedgerInvoices(invoiceIds: string[]): string {
  if (invoiceIds.length === 0) return '—'
  if (invoiceIds.length <= 2) return invoiceIds.join(', ')
  return `${invoiceIds.length} invoices`
}
