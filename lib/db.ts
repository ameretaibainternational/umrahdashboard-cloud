/**
 * Data abstraction layer.
 * In demo mode  → reads/writes from the in-memory demoStore (no Supabase needed).
 * In production → queries Supabase.
 */

import { isDemoMode } from './is-demo'
import { demoStore } from './demo-store'
import { isAdminPermission } from './permissions'
import { hasDirectDb, isDirectDbConnectionError, markDirectDbAuthFailed } from './sql'
import type { Airline, Hotel, Booking, Payment, Expense, StaffUser, VisaSettings, CurrencySettings, TransportRate, Company, InvoiceSettings, InvoiceClient, CustomInvoice, HotelVoucherSettings, HotelVoucherRecord, StorageUsage, StoredFileRow, StaffActivityStats } from './types'
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

async function withDirectDbFallback<T>(
  direct: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  if (!hasDirectDb()) return fallback()
  try {
    return await direct()
  } catch (error) {
    if (isDirectDbConnectionError(error)) markDirectDbAuthFailed()
    else throw error
    return fallback()
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
  if (isDemoMode()) return [...demoStore.transportRates]
  const sb = await getSupabase()
  const { data } = await sb.from('transport_rates').select('*').order('type').order('pax_count')
  return data ?? []
}

// ── Company ───────────────────────────────────────────────────────────────────

export async function getCompany(): Promise<Company> {
  if (isDemoMode()) return { ...demoStore.company }
  const sb = await getSupabase()
  const { data } = await sb.from('company').select('*').single()
  return data ?? { id: '', name: 'Fast Travels & Tours', license: 'Govt License', phone: '', website: 'fasttravels.pk', address: 'Pakistan', logo_url: '' }
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function getBookings(): Promise<Booking[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) return filterByOwner([...demoStore.bookings], ownerId)
  return withDirectDbFallback(
    async () => {
      const { fetchBookings } = await import('@/lib/crm-db')
      return fetchBookings(ownerId)
    },
    async () => {
      const sb = await getSupabase()
      const { data } = await sb.from('bookings').select('*').order('created_at', { ascending: false })
      return filterByOwner(data ?? [], ownerId)
    },
  )
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getPayments(): Promise<Payment[]> {
  const ownerId = await getOwnerFilter()
  if (isDemoMode()) return filterByOwner([...demoStore.payments], ownerId)
  return withDirectDbFallback(
    async () => {
      const { fetchPayments } = await import('@/lib/crm-db')
      return fetchPayments(ownerId)
    },
    async () => {
      const sb = await getSupabase()
      const { data } = await sb.from('payments').select('*').order('created_at', { ascending: false })
      return filterByOwner(data ?? [], ownerId)
    },
  )
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
      const sb = await getSupabase()
      const { data } = await sb.from('expenses').select('*').order('created_at', { ascending: false })
      return filterByOwner(data ?? [], ownerId)
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

export async function getPackageInvoices(): Promise<CustomInvoice[]> {
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  const invoices = await getCustomInvoices()
  return invoices.filter(inv => isPackageInvoice(inv) && !inv.file_deleted_at)
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
      const sb = await getSupabase()
      const { data } = await sb.from('custom_invoices').select('*').eq('id', id).maybeSingle()
      if (!data || !isPackageInvoice(data)) return null
      if (ownerId && data.created_by !== ownerId) return null
      const { mapCustomInvoiceRow } = await import('@/lib/document-db')
      return mapCustomInvoiceRow(data as Record<string, unknown>)
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
  if (!hasDirectDb()) return empty
  try {
    const { fetchStorageUsage } = await import('@/lib/document-db')
    return await fetchStorageUsage()
  } catch (error) {
    if (isDirectDbConnectionError(error)) markDirectDbAuthFailed()
    return empty
  }
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
    async () => [],
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
