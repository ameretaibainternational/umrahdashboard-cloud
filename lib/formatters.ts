export function pkr(n: number): string {
  return 'PKR ' + Math.round(n).toLocaleString('en-PK')
}

export function sar(n: number): string {
  return n.toLocaleString('en-PK') + ' SAR'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

type BookingInvoiceRef = { id: string; invoice_number?: string | null }

export function bookingInvoiceId(bookingOrId: string | BookingInvoiceRef): string {
  if (typeof bookingOrId === 'string') {
    return `INV-${bookingOrId.slice(0, 8).toUpperCase()}`
  }
  const linked = bookingOrId.invoice_number?.trim()
  if (linked) return linked
  return `INV-${bookingOrId.id.slice(0, 8).toUpperCase()}`
}
