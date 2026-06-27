import type { CustomInvoice, PackageInvoiceData } from '@/lib/types'

export const PACKAGE_DATA_TERMS_PREFIX = '__PKG__:'

export function isPackageInvoice(inv: {
  invoice_kind?: string | null
  package_data?: unknown
  invoice_number?: string | null
  terms_text?: string | null
}): boolean {
  if (inv.invoice_kind === 'package') return true
  if (inv.package_data != null) return true
  if (inv.invoice_number?.startsWith('INV-')) return true
  if (inv.terms_text?.startsWith(PACKAGE_DATA_TERMS_PREFIX)) return true
  return false
}

export function encodePackageDataInTerms(data: PackageInvoiceData): string {
  return `${PACKAGE_DATA_TERMS_PREFIX}${JSON.stringify(data)}`
}

export function decodePackageDataFromTerms(terms: string | null | undefined): PackageInvoiceData | null {
  if (!terms?.startsWith(PACKAGE_DATA_TERMS_PREFIX)) return null
  try {
    return parsePackageInvoiceData(JSON.parse(terms.slice(PACKAGE_DATA_TERMS_PREFIX.length)))
  } catch {
    return null
  }
}

export function getPackageDataFromInvoice(inv: {
  package_data?: unknown
  terms_text?: string | null
}): PackageInvoiceData | null {
  const fromColumn = parsePackageInvoiceData(inv.package_data)
  if (fromColumn) return fromColumn
  return decodePackageDataFromTerms(inv.terms_text)
}

export function parsePackageInvoiceData(raw: unknown): PackageInvoiceData | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  return {
    adult: Number(d.adult ?? 1),
    child: Number(d.child ?? 0),
    infant: Number(d.infant ?? 0),
    airlineId: String(d.airlineId ?? ''),
    transportType: d.transportType === 'private' ? 'private' : 'bus',
    makkahHotelId: String(d.makkahHotelId ?? ''),
    makkahRoom: (['sharing', 'quad', 'triple', 'double'].includes(String(d.makkahRoom))
      ? d.makkahRoom
      : 'sharing') as PackageInvoiceData['makkahRoom'],
    makkahNights: Number(d.makkahNights ?? 10),
    madinahHotelId: String(d.madinahHotelId ?? ''),
    madinahRoom: (['sharing', 'quad', 'triple', 'double'].includes(String(d.madinahRoom))
      ? d.madinahRoom
      : 'sharing') as PackageInvoiceData['madinahRoom'],
    madinahNights: Number(d.madinahNights ?? 10),
    profitType: d.profitType === 'fixed' ? 'fixed' : 'percent',
    profitValue: Number(d.profitValue ?? 8),
    sellingOverride: d.sellingOverride != null ? Number(d.sellingOverride) : null,
    advance: Number(d.advance ?? 0),
    customerName: String(d.customerName ?? ''),
    makkahZiarat: Boolean(d.makkahZiarat),
    madinahZiarat: Boolean(d.madinahZiarat),
    customTicket: Boolean(d.customTicket),
    customTicketLabel: String(d.customTicketLabel ?? ''),
    customTicketAmount: Number(d.customTicketAmount ?? 0),
    customTicketCurrency: d.customTicketCurrency === 'PKR' ? 'PKR' : 'SAR',
    travelDate: String(d.travelDate ?? ''),
    departureCity: String(d.departureCity ?? ''),
    arrivalCity: String(d.arrivalCity ?? ''),
    returnCity: String(d.returnCity ?? ''),
  }
}
