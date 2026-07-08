import type { CustomInvoice, PackageInvoiceData, ZiaratOption } from '@/lib/types'
import { normalizeTransportType } from '@/lib/transport'
import { resolveSelectedZiaratIds, ziaratLegacyFlags, mergeDefaultZiarats } from '@/lib/ziarats'

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

export function decodePackageDataFromTerms(terms: string | null | undefined, ziarats: ZiaratOption[] = []): PackageInvoiceData | null {
  if (!terms?.startsWith(PACKAGE_DATA_TERMS_PREFIX)) return null
  try {
    return parsePackageInvoiceData(JSON.parse(terms.slice(PACKAGE_DATA_TERMS_PREFIX.length)), ziarats)
  } catch {
    return null
  }
}

export function getPackageDataFromInvoice(inv: {
  package_data?: unknown
  terms_text?: string | null
}, ziarats: ZiaratOption[] = []): PackageInvoiceData | null {
  const fromColumn = parsePackageInvoiceData(inv.package_data, ziarats)
  if (fromColumn) return fromColumn
  return decodePackageDataFromTerms(inv.terms_text, ziarats)
}

export function parsePackageInvoiceData(raw: unknown, ziarats: ZiaratOption[] = []): PackageInvoiceData | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const list = ziarats.length > 0 ? ziarats : mergeDefaultZiarats([])
  const selectedZiaratIds = resolveSelectedZiaratIds(d as unknown as PackageInvoiceData, list)
  const legacy = ziaratLegacyFlags(selectedZiaratIds, list)
  return {
    adult: Number(d.adult ?? 1),
    child: Number(d.child ?? 0),
    infant: Number(d.infant ?? 0),
    airlineId: String(d.airlineId ?? ''),
    transportType: normalizeTransportType(d.transportType),
    makkahHotelId: String(d.makkahHotelId ?? ''),
    makkahRoom: (['room', 'sharing', 'quad', 'triple', 'double'].includes(String(d.makkahRoom))
      ? d.makkahRoom
      : 'sharing') as PackageInvoiceData['makkahRoom'],
    makkahNights: Number(d.makkahNights ?? 10),
    madinahHotelId: String(d.madinahHotelId ?? ''),
    madinahRoom: (['room', 'sharing', 'quad', 'triple', 'double'].includes(String(d.madinahRoom))
      ? d.madinahRoom
      : 'sharing') as PackageInvoiceData['madinahRoom'],
    madinahNights: Number(d.madinahNights ?? 10),
    profitType: d.profitType === 'fixed' ? 'fixed' : 'percent',
    profitValue: Number(d.profitValue ?? 8),
    sellingOverride: d.sellingOverride != null ? Number(d.sellingOverride) : null,
    advance: Number(d.advance ?? 0),
    customerName: String(d.customerName ?? ''),
    selectedZiaratIds,
    makkahZiarat: legacy.makkahZiarat,
    madinahZiarat: legacy.madinahZiarat,
    badrZiarat: legacy.badrZiarat,
    taifZiarat: legacy.taifZiarat,
    walkingZiarat: legacy.walkingZiarat,
    includeMakkahHotel: d.includeMakkahHotel !== false,
    includeMadinahHotel: d.includeMadinahHotel !== false,
    includeTickets: d.includeTickets !== false,
    includeTransport: d.includeTransport !== false,
    includeVisa: d.includeVisa !== false,
    customTicket: Boolean(d.customTicket),
    customTicketLabel: String(d.customTicketLabel ?? ''),
    customTicketAmount: Number(d.customTicketAmount ?? 0),
    customTicketCurrency: d.customTicketCurrency === 'PKR' ? 'PKR' : 'SAR',
    travelDate: String(d.travelDate ?? ''),
    departureCity: String(d.departureCity ?? ''),
    arrivalCity: String(d.arrivalCity ?? ''),
    saDepartureCity: String(d.saDepartureCity ?? ''),
    returnCity: String(d.returnCity ?? ''),
    currencyUnit: d.currencyUnit === 'SAR' ? 'SAR' : 'PKR',
    sarToPkr: d.sarToPkr ? Number(d.sarToPkr) : undefined,
    selectedTransportRouteIds: Array.isArray(d.selectedTransportRouteIds) ? d.selectedTransportRouteIds.map(String) : [],
  }
}
