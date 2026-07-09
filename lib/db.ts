/**
 * Data abstraction layer.
 * In demo mode  → reads/writes from the in-memory demoStore (no Supabase needed).
 * In production → queries Supabase.
 */

import { isDemoMode } from './is-demo'
import { demoStore } from './demo-store'
import { isAdminPermission } from './permissions'
import { hasDirectDb, isDirectDbConnectionError, isDirectDbRecoverableError, markDirectDbAuthFailed, requireSql } from './sql'
import { parseFlightCities, DEFAULT_PK_FLIGHT_CITIES, DEFAULT_SA_FLIGHT_CITIES } from './flight-cities'
import type { Airline, Hotel, Booking, Payment, Expense, StaffUser, VisaSettings, CurrencySettings, TransportRate, Company, InvoiceSettings, InvoiceClient, InvoicePaymentMethod, InvoiceService, CustomInvoice, HotelVoucherSettings, HotelVoucherRecord, StorageUsage, StoredFileRow, StaffActivityStats, ZiaratOption, HotelContact, TransportContact, CustomTransport, TransportRoute, TransportVehicle, RouteVehicleRate } from './types'
import { DEFAULT_TRANSPORT_RATE_SAR, TRANSPORT_VEHICLES, transportServiceName } from './transport'
import { customTransportToRateRows } from './custom-transports'
import { mergeDefaultZiarats } from './ziarats'
import { isPackageInvoice } from './package-invoice'

function mergeTransportRates(rows: TransportRate[]): TransportRate[] {
  return TRANSPORT_VEHICLES.flatMap((type, vi) =>
    ([1, 2, 3, 4] as const).map((pax_count, pi) => {
      const fromDb = rows.find(r => r.type === type && r.pax_count === pax_count)
      return fromDb ?? {
        id: `default-${vi}-${pi}`,
        type,
        pax_count,
        rate_sar: DEFAULT_TRANSPORT_RATE_SAR[type][pax_count - 1],
      }
    })
  )
}
import { DEFAULT_URDU_FOOTER, DEFAULT_URDU_GUIDELINES } from './hotel-voucher-defaults'
import { resolveInvoiceSettings } from './invoice-defaults'

async function getSupabase() {
  const { createClient } = await import('./supabase/server')
  return createClient()
}

async function getOwnerFilter(): Promise<string | null> {
  const staff = await getCurrentStaff()
  if (!staff || isAdminPermission(staff.permission)) return null
  return staff.id
}

function filterByOwner<T extends { created_by?: string | null }>(rows: T[], ownerId: string | null): T[] {
  if (!ownerId) return rows
  return rows.filter(row => row.created_by === ownerId)
}

function isSupabaseMissingTableError(message: string): boolean {
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    message.includes('PGRST')
  )
}

async function supabaseSelectAll<T>(
  table: string,
  orderCol = 'created_at',
): Promise<T[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.from(table).select('*').order(orderCol, { ascending: false })
  if (error) {
    if (isSupabaseMissingTableError(error.message)) return []
    throw new Error(error.message)
  }
  return (data ?? []) as T[]
}

async function withDirectDbFallback<T>(
  direct: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  if (!hasDirectDb()) return fallback()
  try {
    return await direct()
  } catch (error) {
    if (isDirectDbRecoverableError(error)) {
      if (isDirectDbConnectionError(error)) markDirectDbAuthFailed()
      return fallback()
    }
    throw error
  }
}

// ── Airlines ────────────────────────────────────────────────────────────────

export async function getAirlines(): Promise<Airline[]> {
  if (isDemoMode()) return [...demoStore.airlines].sort((a, b) => a.name.localeCompare(b.name))
  const sb = await getSupabase()
  const { data } = await sb.from('airlines').select('*').order('name')
  return data ?? []
}

// ── Hotels ───────────────────────────────────────────────────────────────────

export async function getHotels(): Promise<Hotel[]> {
  if (isDemoMode()) return [...demoStore.hotels].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
  const sb = await getSupabase()
  const { data } = await sb.from('hotels').select('*').order('city').order('name')
  return data ?? []
}

// ── Visa settings ────────────────────────────────────────────────────────────

export async function getVisa(): Promise<VisaSettings> {
  if (isDemoMode()) return { ...demoStore.visa }
  const sb = await getSupabase()
  const { data } = await sb.from('visa_settings').select('*').single()
  if (!data) return {
    id: '',
    visa_rate_1_pax: 725,
    visa_rate_2_pax: 700,
    visa_rate_3_pax: 675,
    visa_rate_4_pax: 650,
    visa_rate_group_pax: 600,
    child_sar: 600,
    infant_sar: 460,
    transport_mode: 'included' as const,
    makkah_ziarat_rate: 0,
    madina_ziarat_rate: 0,
    badr_ziarat_rate: 0,
    taif_ziarat_rate: 0,
  }
  // Coerce any columns that may be null if migration hasn't run yet
  return {
    ...data,
    visa_rate_1_pax:     data.visa_rate_1_pax     ?? 725,
    visa_rate_2_pax:     data.visa_rate_2_pax     ?? 700,
    visa_rate_3_pax:     data.visa_rate_3_pax     ?? 675,
    visa_rate_4_pax:     data.visa_rate_4_pax     ?? 650,
    visa_rate_group_pax: data.visa_rate_group_pax ?? 600,
    makkah_ziarat_rate:  data.makkah_ziarat_rate  ?? 0,
    madina_ziarat_rate:  data.madina_ziarat_rate  ?? 0,
    badr_ziarat_rate:    data.badr_ziarat_rate    ?? 0,
    taif_ziarat_rate:    data.taif_ziarat_rate    ?? 0,
  }
}

// ── Currency ─────────────────────────────────────────────────────────────────

export async function getCurrency(): Promise<CurrencySettings> {
  if (isDemoMode()) return { ...demoStore.currency }
  const sb = await getSupabase()
  const { data } = await sb.from('currency_settings').select('*').single()
  return data ?? { id: '', sar_to_pkr: 75 }
}

// ── Transport rates ───────────────────────────────────────────────────────────

export async function getTransportRates(): Promise<TransportRate[]> {
  if (isDemoMode()) {
    const custom = demoStore.customTransports.flatMap(customTransportToRateRows)
    return [...demoStore.transportRates, ...custom]
  }
  const sb = await getSupabase()
  const { data } = await sb.from('transport_rates').select('*').order('type').order('pax_count')
  const customTransports = await getCustomTransports()
  const custom = customTransports.flatMap(customTransportToRateRows)
  return [...mergeTransportRates(data ?? []), ...custom]
}

export async function getCustomTransports(): Promise<CustomTransport[]> {
  if (isDemoMode()) {
    return [...demoStore.customTransports].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('custom_transports').select('*').order('sort_order').order('name')
  return (data ?? []).map(row => ({
    ...row,
    rate_1_sar: Number(row.rate_1_sar),
    rate_2_sar: Number(row.rate_2_sar),
    rate_3_sar: Number(row.rate_3_sar),
    rate_4_sar: Number(row.rate_4_sar),
  })) as CustomTransport[]
}

export async function getTransportRoutes(): Promise<TransportRoute[]> {
  if (isDemoMode()) {
    return [...demoStore.transportRoutes].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('transport_routes').select('*').order('sort_order').order('name')
  return data ?? []
}

export async function getTransportVehicles(): Promise<TransportVehicle[]> {
  if (isDemoMode()) {
    return [...demoStore.transportVehicles].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('transport_vehicles').select('*').order('sort_order').order('name')
  return data ?? []
}

export async function getRouteVehicleRates(): Promise<RouteVehicleRate[]> {
  if (isDemoMode()) {
    return [...demoStore.routeVehicleRates].map(r => ({ ...r, rate_sar: Number(r.rate_sar) }))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('route_vehicle_rates').select('*')
  return (data ?? []).map(r => ({ ...r, rate_sar: Number(r.rate_sar) }))
}

export async function getZiarats(): Promise<ZiaratOption[]> {
  if (isDemoMode()) {
    return [...demoStore.ziarats].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('ziarats').select('*').order('sort_order').order('name')
  return mergeDefaultZiarats((data ?? []) as ZiaratOption[])
}

export async function getHotelContacts(): Promise<HotelContact[]> {
  if (isDemoMode()) {
    return [...demoStore.hotelContacts].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('hotel_contacts').select('*').order('city').order('name')
  return data ?? []
}

export async function getTransportContacts(): Promise<TransportContact[]> {
  if (isDemoMode()) {
    return [...demoStore.transportContacts].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('transport_contacts').select('*').order('city').order('name')
  return data ?? []
}

// ── Company ───────────────────────────────────────────────────────────────────

export async function getCompany(): Promise<Company> {
  if (isDemoMode()) return { ...demoStore.company }
  const sb = await getSupabase()
  const { data } = await sb.from('company').select('*').single()
  const base = data ?? { id: '', name: 'Fast Travels & Tours', license: 'Govt License', phone: '', website: 'fasttravels.pk', address: 'Pakistan', logo_url: '' }
  return {
    ...base,
    pk_flight_cities: parseFlightCities(base.pk_flight_cities, DEFAULT_PK_FLIGHT_CITIES),
    sa_flight_cities: parseFlightCities(base.sa_flight_cities, DEFAULT_SA_FLIGHT_CITIES),
  }
}

// ── Bookings ──────────────────────────────────────────────────────────────────

function attachInvoiceNumbers(bookings: Booking[], invoices: CustomInvoice[]): Booking[] {
  const byId = new Map(invoices.map(inv => [inv.id, inv.invoice_number]))
  const fallbackByBookingId = new Map<string, string>()

  for (const inv of invoices) {
    if (!isPackageInvoice(inv)) continue
    if (bookings.some(b => b.source_invoice_id === inv.id)) continue

    const match = bookings.find(b =>
      !fallbackByBookingId.has(b.id) &&
      b.customer_name === inv.billed_to_name &&
      b.total_pkr === inv.total &&
      b.booking_date === inv.invoice_date,
    )
    if (match) fallbackByBookingId.set(match.id, inv.invoice_number)
  }

  return bookings.map(b => ({
    ...b,
    invoice_number:
      (b.source_invoice_id ? (byId.get(b.source_invoice_id) ?? null) : null)
      ?? fallbackByBookingId.get(b.id)
      ?? null,
  }))
}

export async function getBookings(): Promise<Booking[]> {
  const ownerId = await getOwnerFilter()
  let bookings: Booking[]
  if (isDemoMode()) {
    bookings = filterByOwner([...demoStore.bookings], ownerId)
  } else {
    bookings = await withDirectDbFallback(
      async () => {
        const { fetchBookings } = await import('@/lib/crm-db')
        return fetchBookings(ownerId)
      },
      async () => {
        const rows = await supabaseSelectAll<Booking>('bookings')
        return filterByOwner(rows, ownerId)
      },
    )
  }
  const invoices = await getCustomInvoices()
  const customInvoiceIds = new Set(
    invoices.filter(inv => !isPackageInvoice(inv)).map(inv => inv.id),
  )
  bookings = bookings.filter(b => !b.source_invoice_id || !customInvoiceIds.has(b.source_invoice_id))
  return attachInvoiceNumbers(bookings, invoices)
}

export async function findBookingForCustomInvoice(
  invoiceId: string,
  snapshot: { customer_name: string; booking_date: string; total_pkr: number },
  ownerId?: string | null,
): Promise<Booking | null> {
  if (isDemoMode()) {
    const linked = demoStore.bookings.find(b => b.source_invoice_id === invoiceId)
    if (linked) return linked
    return demoStore.bookings.find(b =>
      b.customer_name === snapshot.customer_name &&
      b.booking_date === snapshot.booking_date &&
      b.total_pkr === snapshot.total_pkr,
    ) ?? null
  }

  return withDirectDbFallback(
    async () => {
      const { findBookingForCustomInvoiceDirect } = await import('@/lib/crm-db')
      return findBookingForCustomInvoiceDirect(invoiceId, snapshot, ownerId)
    },
    async () => {
      const sb = await getSupabase()
      const mapRow = (row: Booking): Booking => ({
        ...row,
        total_pkr: Number(row.total_pkr),
        cost_pkr: Number(row.cost_pkr),
        profit_pkr: Number(row.profit_pkr),
        advance_pkr: Number(row.advance_pkr),
        paid_pkr: Number(row.paid_pkr),
        remaining_pkr: Number(row.remaining_pkr),
        adult_count: Number(row.adult_count),
        child_count: Number(row.child_count),
        infant_count: Number(row.infant_count),
        makkah_nights: row.makkah_nights != null ? Number(row.makkah_nights) : null,
        madinah_nights: row.madinah_nights != null ? Number(row.madinah_nights) : null,
      })

      let linkedQuery = sb.from('bookings').select('*').eq('source_invoice_id', invoiceId)
      if (ownerId) linkedQuery = linkedQuery.eq('created_by', ownerId)
      const linkedResult = await linkedQuery.maybeSingle()
      if (!linkedResult.error && linkedResult.data) {
        return mapRow(linkedResult.data as Booking)
      }

      const { data: rows } = await sb.from('bookings').select('*').order('created_at', { ascending: false })
      const match = filterByOwner((rows ?? []) as Booking[], ownerId ?? null).find(b =>
        b.customer_name === snapshot.customer_name &&
        b.booking_date === snapshot.booking_date &&
        Number(b.total_pkr) === snapshot.total_pkr,
      )
      return match ? mapRow(match) : null
    },
  )
}

export async function linkBookingToInvoice(bookingId: string, invoiceId: string): Promise<void> {
  if (isDemoMode()) {
    const booking = demoStore.bookings.find(b => b.id === bookingId)
    if (booking) booking.source_invoice_id = invoiceId
    return
  }

  return withDirectDbFallback(
    async () => {
      const { linkBookingToInvoiceDirect } = await import('@/lib/crm-db')
      await linkBookingToInvoiceDirect(bookingId, invoiceId)
    },
    async () => {
      const sb = await getSupabase()
      const { error } = await sb.from('bookings').update({ source_invoice_id: invoiceId }).eq('id', bookingId)
      if (error && !error.message.includes('source_invoice_id') && !error.message.includes('schema cache')) {
        throw new Error(error.message)
      }
    },
  )
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getPayments(): Promise<Payment[]> {
  const ownerId = await getOwnerFilter()
  let payments: Payment[]
  if (isDemoMode()) {
    payments = filterByOwner([...demoStore.payments], ownerId)
  } else {
    payments = await withDirectDbFallback(
      async () => {
        const { fetchPayments } = await import('@/lib/crm-db')
        return fetchPayments(ownerId)
      },
      async () => {
        const rows = await supabaseSelectAll<Payment>('payments')
        return filterByOwner(rows, ownerId)
      },
    )
  }
  return payments.map(p => ({
    ...p,
    amount_pkr: Number(p.amount_pkr),
    booking_id: p.booking_id || (p.invoice_id ? `invoice-${p.invoice_id}` : p.booking_id),
  }))
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) return filterByOwner([...(demoStore.expenses ?? [])], ownerId)
  return withDirectDbFallback(
    async () => {
      const { fetchExpenses } = await import('@/lib/crm-db')
      return fetchExpenses(ownerId)
    },
    async () => {
      const rows = await supabaseSelectAll<Expense>('expenses', 'expense_date')
      return filterByOwner(rows, ownerId)
    },
  )
}

// ── Invoice Settings ─────────────────────────────────────────────────────────

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  if (isDemoMode()) return resolveInvoiceSettings(demoStore.invoiceSettings)
  const sb = await getSupabase()
  const { data } = await sb.from('invoice_settings').select('*').maybeSingle()
  return resolveInvoiceSettings(data)
}

export async function getInvoiceClients(): Promise<InvoiceClient[]> {
  if (isDemoMode()) {
    return [...demoStore.invoiceClients].sort((a, b) => a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('invoice_clients').select('*').order('name')
  return data ?? []
}

export async function getInvoicePaymentMethods(): Promise<InvoicePaymentMethod[]> {
  if (isDemoMode()) {
    return [...demoStore.invoicePaymentMethods].sort((a, b) => a.label.localeCompare(b.label))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('invoice_payment_methods').select('*').order('label')
  return data ?? []
}

export async function getInvoiceServices(): Promise<InvoiceService[]> {
  const transportDefaults = TRANSPORT_VEHICLES.map((vehicle, i) => ({
    id: `default-transport-${i}`,
    name: transportServiceName(vehicle),
  }))
  if (isDemoMode()) {
    return [...demoStore.invoiceServices].sort((a, b) => a.name.localeCompare(b.name))
  }
  const sb = await getSupabase()
  const { data } = await sb.from('invoice_services').select('*').order('name')
  const rows = data ?? []
  const names = new Set(rows.map(r => r.name))
  const merged = [
    ...rows,
    ...transportDefaults.filter(s => !names.has(s.name)),
  ]
  return merged.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Hotel Voucher Settings ─────────────────────────────────────────────────────

function defaultHotelVoucherSettings(): HotelVoucherSettings {
  return {
    id: '',
    urdu_guidelines: [...DEFAULT_URDU_GUIDELINES],
    urdu_footer: DEFAULT_URDU_FOOTER,
  }
}

export async function getHotelVoucherSettings(): Promise<HotelVoucherSettings> {
  if (isDemoMode()) {
    return {
      ...demoStore.hotelVoucherSettings,
      urdu_guidelines: [...demoStore.hotelVoucherSettings.urdu_guidelines],
    }
  }
  const sb = await getSupabase()
  const { data } = await sb.from('hotel_voucher_settings').select('*').maybeSingle()
  if (!data) return defaultHotelVoucherSettings()
  const guidelines = Array.isArray(data.urdu_guidelines) ? data.urdu_guidelines as string[] : [...DEFAULT_URDU_GUIDELINES]
  return {
    id: data.id,
    urdu_guidelines: guidelines.length > 0 ? guidelines : [...DEFAULT_URDU_GUIDELINES],
    urdu_footer: data.urdu_footer || DEFAULT_URDU_FOOTER,
    updated_at: data.updated_at,
  }
}

// ── Custom Invoices ──────────────────────────────────────────────────────────

export async function getCustomInvoices(): Promise<CustomInvoice[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) return filterByOwner([...demoStore.customInvoices], ownerId)
  return withDirectDbFallback(
    async () => {
      const { fetchCustomInvoices } = await import('@/lib/document-db')
      return fetchCustomInvoices(ownerId)
    },
    async () => {
      const sb = await getSupabase()
      const { data } = await sb.from('custom_invoices').select('*').order('created_at', { ascending: false })
      const { mapCustomInvoiceRow } = await import('@/lib/document-db')
      return filterByOwner((data ?? []).map(row => mapCustomInvoiceRow(row as Record<string, unknown>)), ownerId)
    },
  )
}

export async function getAllInvoiceNumbers(): Promise<{ invoice_number: string }[]> {
  if (isDemoMode()) {
    return demoStore.customInvoices.map(i => ({ invoice_number: i.invoice_number }))
  }
  return withDirectDbFallback(
    async () => {
      const sql = requireSql()
      return sql<{ invoice_number: string }[]>`SELECT invoice_number FROM custom_invoices`
    },
    async () => {
      const sb = await getSupabase()
      const { data } = await sb.from('custom_invoices').select('invoice_number')
      return (data ?? []) as { invoice_number: string }[]
    },
  )
}

export async function getAllPackageInvoiceNumbers(): Promise<{ invoice_number: string }[]> {
  const invoices = await getAllInvoiceNumbers()
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  return invoices.filter(inv => isPackageInvoice(inv))
}

export async function getPackageInvoices(): Promise<CustomInvoice[]> {
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  const invoices = await getCustomInvoices()
  return invoices.filter(inv => isPackageInvoice(inv) && !inv.file_deleted_at)
}

export async function getStandaloneCustomInvoices(): Promise<CustomInvoice[]> {
  const invoices = await getCustomInvoices()
  return invoices.filter(inv => !isPackageInvoice(inv) && !inv.file_deleted_at)
}

export async function getCustomInvoiceById(id: string): Promise<CustomInvoice | null> {
  const ownerId = await getOwnerFilter()
  const { isPackageInvoice } = await import('@/lib/package-invoice')

  if (isDemoMode()) {
    const inv = demoStore.customInvoices.find(i => i.id === id && !isPackageInvoice(i))
    if (!inv) return null
    if (ownerId && inv.created_by !== ownerId) return null
    return inv
  }

  return withDirectDbFallback(
    async () => {
      const { fetchCustomInvoiceById } = await import('@/lib/document-db')
      return fetchCustomInvoiceById(id, ownerId)
    },
    async () => {
      const { fetchCustomInvoiceByIdSupabase } = await import('@/lib/supabase-document-db')
      return fetchCustomInvoiceByIdSupabase(id, ownerId)
    },
  )
}

export async function getPackageInvoiceById(id: string): Promise<CustomInvoice | null> {
  const ownerId = await getOwnerFilter()
  const { isPackageInvoice } = await import('@/lib/package-invoice')

  if (isDemoMode()) {
    const inv = demoStore.customInvoices.find(i => i.id === id && isPackageInvoice(i))
    if (!inv) return null
    if (ownerId && inv.created_by !== ownerId) return null
    return inv
  }

  return withDirectDbFallback(
    async () => {
      const { fetchPackageInvoiceById } = await import('@/lib/document-db')
      return fetchPackageInvoiceById(id, ownerId)
    },
    async () => {
      const { fetchPackageInvoiceByIdSupabase } = await import('@/lib/supabase-document-db')
      return fetchPackageInvoiceByIdSupabase(id, ownerId)
    },
  )
}

export async function getHotelVouchers(): Promise<HotelVoucherRecord[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) return filterByOwner([...demoStore.hotelVouchers], ownerId)
  return withDirectDbFallback(
    async () => {
      const { fetchHotelVouchers } = await import('@/lib/document-db')
      return fetchHotelVouchers(ownerId)
    },
    async () => {
      const sb = await getSupabase()
      const { data } = await sb.from('hotel_vouchers').select('*').order('created_at', { ascending: false })
      return filterByOwner(data ?? [], ownerId)
    },
  )
}

export async function getStorageUsage(): Promise<StorageUsage> {
  if (isDemoMode()) return { ...demoStore.storageUsage }
  const empty = { id: '', total_bytes: 0, updated_at: new Date().toISOString() }

  return withDirectDbFallback(
    async () => {
      const { fetchStorageUsage } = await import('@/lib/document-db')
      return await fetchStorageUsage()
    },
    async () => {
      try {
        const { fetchStorageUsageSupabase } = await import('@/lib/supabase-document-db')
        return await fetchStorageUsageSupabase()
      } catch {
        return empty
      }
    },
  )
}

/** All invoice + voucher rows that still have a stored PDF file. */
export async function getStoredFiles(): Promise<StoredFileRow[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) {
    const rows: StoredFileRow[] = []
    for (const inv of demoStore.customInvoices) {
      if (ownerId && inv.created_by !== ownerId) continue
      if (!inv.file_deleted_at && inv.storage_key && inv.file_size_bytes) {
        rows.push({
          id: inv.id,
          type: 'invoice',
          number: inv.invoice_number,
          label: inv.billed_to_name,
          date: inv.invoice_date,
          file_size_bytes: inv.file_size_bytes,
          created_at: inv.created_at,
        })
      }
    }
    for (const v of demoStore.hotelVouchers) {
      if (ownerId && v.created_by !== ownerId) continue
      if (!v.file_deleted_at && v.storage_key && v.file_size_bytes) {
        rows.push({
          id: v.id,
          type: 'voucher',
          number: v.voucher_number,
          label: v.family_head,
          date: v.voucher_date,
          file_size_bytes: v.file_size_bytes,
          created_at: v.created_at,
        })
      }
    }
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  return withDirectDbFallback(
    async () => {
      const { fetchStoredFiles } = await import('@/lib/document-db')
      return fetchStoredFiles(ownerId)
    },
    async () => {
      try {
        const { fetchStoredFilesSupabase } = await import('@/lib/supabase-document-db')
        return await fetchStoredFilesSupabase(ownerId)
      } catch {
        return []
      }
    },
  )
}

// ── Staff users ───────────────────────────────────────────────────────────────

export async function getStaff(): Promise<StaffUser[]> {
  if (isDemoMode()) return [...demoStore.staff]
  const sb = await getSupabase()
  const { data } = await sb.from('staff_users').select('*').order('created_at', { ascending: false })
  return data ?? []
}

/**
 * Returns the currently logged-in user's staff record.
 * In demo mode always returns a Full Access admin so the demo behaves the same.
 */
export async function getCurrentStaff(): Promise<StaffUser | null> {
  if (isDemoMode()) {
    return { id: 'demo', name: 'Demo Admin', username: 'admin', role: 'Admin', permission: 'Full Access', status: 'Active', created_at: new Date().toISOString() }
  }
  const sb = await getSupabase()
  const { data: { session } } = await sb.auth.getSession()
  const user = session?.user
  if (!user) return null
  const { data } = await sb.from('staff_users').select('*').eq('id', user.id).single()
  return data ?? null
}

export async function getStaffActivityStats(): Promise<StaffActivityStats[]> {
  const staff = await getCurrentStaff()
  if (!staff || !isAdminPermission(staff.permission)) return []

  if (isDemoMode()) {
    return demoStore.staff.map(s => ({
      staff_id: s.id,
      staff_name: s.name,
      bookings: demoStore.bookings.filter(b => b.created_by === s.id).length,
      custom_invoices: demoStore.customInvoices.filter(i => i.created_by === s.id).length,
      hotel_vouchers: demoStore.hotelVouchers.filter(v => v.created_by === s.id).length,
      payments: demoStore.payments.filter(p => p.created_by === s.id).length,
      expenses: (demoStore.expenses ?? []).filter(e => e.created_by === s.id).length,
    }))
  }

  return withDirectDbFallback(
    async () => {
      const { fetchStaffActivityStats } = await import('@/lib/document-db')
      return fetchStaffActivityStats()
    },
    async () => [],
  )
}

export async function getBookingById(id: string): Promise<Booking | null> {
  if (isDemoMode()) {
    const b = demoStore.bookings.find(x => x.id === id)
    return b ? { ...b } : null
  }
  return withDirectDbFallback(
    async () => {
      const sb = await getSupabase()
      const { data, error } = await sb.from('bookings').select('*').eq('id', id).single()
      if (error || !data) return null
      return {
        ...data,
        total_pkr: Number(data.total_pkr),
        cost_pkr: Number(data.cost_pkr),
        profit_pkr: Number(data.profit_pkr),
        advance_pkr: Number(data.advance_pkr),
        paid_pkr: Number(data.paid_pkr),
        remaining_pkr: Number(data.remaining_pkr),
        adult_count: Number(data.adult_count),
        child_count: Number(data.child_count),
        infant_count: Number(data.infant_count),
        makkah_nights: data.makkah_nights != null ? Number(data.makkah_nights) : null,
        madinah_nights: data.madinah_nights != null ? Number(data.madinah_nights) : null,
      } as Booking
    },
    async () => {
      const sb = await getSupabase()
      const { data, error } = await sb.from('bookings').select('*').eq('id', id).single()
      if (error || !data) return null
      return {
        ...data,
        total_pkr: Number(data.total_pkr),
        cost_pkr: Number(data.cost_pkr),
        profit_pkr: Number(data.profit_pkr),
        advance_pkr: Number(data.advance_pkr),
        paid_pkr: Number(data.paid_pkr),
        remaining_pkr: Number(data.remaining_pkr),
        adult_count: Number(data.adult_count),
        child_count: Number(data.child_count),
        infant_count: Number(data.infant_count),
        makkah_nights: data.makkah_nights != null ? Number(data.makkah_nights) : null,
        madinah_nights: data.madinah_nights != null ? Number(data.madinah_nights) : null,
      } as Booking
    }
  )
}
