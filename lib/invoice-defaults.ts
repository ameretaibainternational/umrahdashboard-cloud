import type { CustomInvoice, InvoiceSettings } from '@/lib/types'

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  id: '',
  payment_bank_name: 'Meezan Bank',
  payment_account_number: '01234567890123',
  terms_text:
    'All payments are due upon receipt. Late payments may incur additional charges. Services rendered are non-refundable once confirmed. Visa approval is subject to Saudi embassy decision and is not guaranteed.',
  contact_phone: '+92 300 0000000',
  contact_email: 'info@example.pk',
  contact_location: 'Lahore, Pakistan',
}

export function resolveInvoiceSettings(settings: InvoiceSettings | null): InvoiceSettings {
  if (!settings) return { ...DEFAULT_INVOICE_SETTINGS }
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...settings,
    payment_bank_name: settings.payment_bank_name || DEFAULT_INVOICE_SETTINGS.payment_bank_name,
    payment_account_number: settings.payment_account_number || DEFAULT_INVOICE_SETTINGS.payment_account_number,
    terms_text: settings.terms_text || DEFAULT_INVOICE_SETTINGS.terms_text,
    contact_phone: settings.contact_phone || DEFAULT_INVOICE_SETTINGS.contact_phone,
    contact_email: settings.contact_email || DEFAULT_INVOICE_SETTINGS.contact_email,
    contact_location: settings.contact_location || DEFAULT_INVOICE_SETTINGS.contact_location,
  }
}

export function getNextInvoiceNumber(invoices: Pick<CustomInvoice, 'invoice_number'>[]): string {
  let max = 0
  for (const inv of invoices) {
    const match = /^ATI-(\d+)$/i.exec(inv.invoice_number.trim())
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return `ATI-${String(max + 1).padStart(3, '0')}`
}
