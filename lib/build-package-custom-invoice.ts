import type { CalcResult, CustomInvoice, CustomInvoiceLineItem, Company, InvoiceSettings, Hotel, RoomType } from './types'
import type { TransportVehicle } from './transport'
import { transportServiceName } from './transport'
import { pkr } from './formatters'

interface BuildPackageInvoiceInput {
  invoiceNo: string
  invoiceDate: string
  customerName: string
  billedToAddress?: string
  billedToClientNumber?: string
  advance: number
  calc: CalcResult
  adult: number
  child: number
  infant: number
  airlineName: string
  makkahHotel: Hotel | null
  makkahRoom: RoomType
  makkahNights: number
  madinahHotel: Hotel | null
  madinahRoom: RoomType
  madinahNights: number
  includeMakkahHotel: boolean
  includeMadinahHotel: boolean
  includeTickets: boolean
  travelDate: string
  transportType: TransportVehicle
  company: Company
  invoiceSettings: InvoiceSettings
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function buildPackageCustomInvoice(input: BuildPackageInvoiceInput): CustomInvoice {
  const {
    invoiceNo, invoiceDate, customerName, billedToAddress = '', billedToClientNumber = '', advance, calc,
    adult, child, infant, airlineName,
    makkahHotel, makkahRoom, makkahNights,
    madinahHotel, madinahRoom, madinahNights,
    includeMakkahHotel, includeMadinahHotel, includeTickets,
    transportType,
    company, invoiceSettings,
  } = input

  const pax = Math.max(1, adult + child + infant)
  const items: CustomInvoiceLineItem[] = []

  const push = (service: string, total: number, allowZero = false) => {
    if (total <= 0 && !allowZero) return
    items.push({
      service,
      pax_price: null,
      pax_price_unit: '',
      night_price: null,
      night_price_unit: '',
      total_pax: pax,
      total,
      total_unit: 'PKR',
      received: 0,
    })
  }

  if (includeTickets) push(`Air Tickets — ${airlineName || 'Standard'}`, calc.ticketCost)
  push('Visa Processing', calc.visaCost)
  if (calc.transportCost > 0) push(transportServiceName(transportType), calc.transportCost)
  if (includeMakkahHotel && calc.makkahCost > 0) {
    push(`Makkah Hotel — ${makkahHotel?.name ?? 'Hotel'} (${cap(makkahRoom)}, ${makkahNights}N)`, calc.makkahCost)
  }
  if (includeMadinahHotel && calc.madinahCost > 0) {
    push(`Madinah Hotel — ${madinahHotel?.name ?? 'Hotel'} (${cap(madinahRoom)}, ${madinahNights}N)`, calc.madinahCost)
  }
  for (const item of calc.ziaratItems) {
    push(item.name, item.cost, item.cost === 0)
  }

  if (items.length === 0) {
    items.push({
      service: `Umrah Package (${pax} Pax)`,
      pax_price: null,
      pax_price_unit: '',
      night_price: null,
      night_price_unit: '',
      total_pax: pax,
      total: calc.selling,
      total_unit: 'PKR',
      received: advance,
    })
  } else {
    items[0].received = advance
  }

  const total = calc.selling
  const received = advance
  const remaining = calc.remaining

  return {
    id: '',
    invoice_number: invoiceNo,
    invoice_date: invoiceDate,
    billed_to_name: customerName,
    billed_to_address: billedToAddress,
    billed_to_client_number: billedToClientNumber,
    payment_bank_name: invoiceSettings.payment_bank_name,
    payment_account_number: invoiceSettings.payment_account_number,
    terms_text: invoiceSettings.terms_text,
    contact_phone: invoiceSettings.contact_phone || company.phone,
    contact_email: invoiceSettings.contact_email || company.website,
    contact_location: invoiceSettings.contact_location || company.address,
    line_items: items,
    total,
    received,
    remaining,
    created_at: '',
    invoice_kind: 'package',
  }
}

export function formatHotelForWhatsApp(hotel: Hotel | null): string {
  if (!hotel) return 'N/A'
  const parts = [hotel.name]
  if (hotel.distance) parts.push(hotel.distance)
  if (hotel.location) parts.push(hotel.location)
  return parts.join(' · ')
}

export function formatRoute(
  departureCity: string,
  arrivalCity: string,
  saDepartureCity: string,
  returnCity: string,
): string {
  return [departureCity, arrivalCity, saDepartureCity, returnCity]
    .filter(Boolean)
    .join(' ➜ ') || '—'
}

export { pkr }
