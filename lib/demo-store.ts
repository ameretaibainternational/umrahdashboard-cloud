import type { Airline, Hotel, Booking, Payment, Expense, StaffUser, VisaSettings, CurrencySettings, TransportRate, Company, InvoiceSettings, CustomInvoice, HotelVoucherSettings, HotelVoucherRecord, StorageUsage } from './types'
import { DEFAULT_URDU_FOOTER, DEFAULT_URDU_GUIDELINES } from './hotel-voucher-defaults'
import { DEFAULT_INVOICE_SETTINGS } from './invoice-defaults'
import { demoFileStore } from './demo-file-store'

// ---------------------------------------------------------------------------
// Singleton in-memory store — survives multiple requests in dev server
// Resets on server restart (expected demo behavior)
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const DEFAULT_AIRLINES: Airline[] = [
  { id: 'a1', name: 'Saudi Airlines', adult_pkr: 85000, child_pkr: 75000, infant_pkr: 15000 },
  { id: 'a2', name: 'AirSial', adult_pkr: 75000, child_pkr: 65000, infant_pkr: 12000 },
  { id: 'a3', name: 'Flynas', adult_pkr: 78000, child_pkr: 68000, infant_pkr: 13000 },
  { id: 'a4', name: 'Serene Air', adult_pkr: 80000, child_pkr: 70000, infant_pkr: 14000 },
]

const DEFAULT_HOTELS: Hotel[] = [
  { id: 'h1', city: 'Makkah', name: 'Hilton Suites Makkah', location: 'Abraj Al-Bait', distance: '50-100 MTR', sharing_sar: 450, quad_sar: 550, triple_sar: 700, double_sar: 950 },
  { id: 'h2', city: 'Makkah', name: 'Swissotel Makkah', location: 'Abraj Al-Bait', distance: '50-100 MTR', sharing_sar: 420, quad_sar: 520, triple_sar: 670, double_sar: 920 },
  { id: 'h3', city: 'Makkah', name: 'Pullman ZamZam Makkah', location: 'Abraj Al-Bait', distance: '100-200 MTR', sharing_sar: 350, quad_sar: 450, triple_sar: 600, double_sar: 850 },
  { id: 'h4', city: 'Makkah', name: 'Anjum Hotel Makkah', location: 'Al Haram', distance: '200-300 MTR', sharing_sar: 300, quad_sar: 400, triple_sar: 550, double_sar: 800 },
  { id: 'h5', city: 'Makkah', name: 'Al Safwah Royale Orchid', location: 'Al Haram', distance: '300-400 MTR', sharing_sar: 250, quad_sar: 350, triple_sar: 500, double_sar: 750 },
  { id: 'h6', city: 'Makkah', name: 'Dar Al Taqwa Hotel', location: 'Al Haram', distance: '200 MTR', sharing_sar: 280, quad_sar: 380, triple_sar: 530, double_sar: 780 },
  { id: 'h7', city: 'Makkah', name: 'Sheraton Makkah Jabal Al Kaaba', location: 'Al Haram', distance: '500 MTR', sharing_sar: 240, quad_sar: 340, triple_sar: 490, double_sar: 740 },
  { id: 'h8', city: 'Makkah', name: 'Grand Millennium Makkah', location: 'Al Haram', distance: '700-800 MTR', sharing_sar: 180, quad_sar: 280, triple_sar: 430, double_sar: 680 },
  { id: 'h9', city: 'Makkah', name: 'Al Rayyan Hotel Makkah', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 100, quad_sar: 200, triple_sar: 350, double_sar: 600 },
  { id: 'h10', city: 'Makkah', name: 'Rawaq Hotel Makkah', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 90, quad_sar: 190, triple_sar: 340, double_sar: 590 },
  { id: 'h11', city: 'Madinah', name: 'Anwar Al Madinah Mövenpick', location: 'Al Haram', distance: '50-100 MTR', sharing_sar: 300, quad_sar: 400, triple_sar: 550, double_sar: 800 },
  { id: 'h12', city: 'Madinah', name: 'Madinah Hilton Hotel', location: 'Al Haram', distance: '100-200 MTR', sharing_sar: 280, quad_sar: 380, triple_sar: 530, double_sar: 780 },
  { id: 'h13', city: 'Madinah', name: 'Al Shohada Hotel', location: 'Al Haram', distance: '100 MTR', sharing_sar: 260, quad_sar: 360, triple_sar: 510, double_sar: 760 },
  { id: 'h14', city: 'Madinah', name: 'Pullman Zamzam Madinah', location: 'Al Haram', distance: '300 MTR', sharing_sar: 220, quad_sar: 320, triple_sar: 470, double_sar: 720 },
  { id: 'h15', city: 'Madinah', name: 'Oberoi Madinah', location: 'Al Haram', distance: '400 MTR', sharing_sar: 350, quad_sar: 450, triple_sar: 600, double_sar: 850 },
  { id: 'h16', city: 'Madinah', name: 'Al Eiman Royal Hotel', location: 'Al Haram', distance: '600-700 MTR', sharing_sar: 150, quad_sar: 250, triple_sar: 400, double_sar: 650 },
  { id: 'h17', city: 'Madinah', name: 'Dallah Taibah Hotel', location: 'Al Haram', distance: '1 KM', sharing_sar: 120, quad_sar: 220, triple_sar: 370, double_sar: 620 },
  { id: 'h18', city: 'Madinah', name: 'Saja Al Madinah Hotel', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 100, quad_sar: 200, triple_sar: 350, double_sar: 600 },
]

const DEFAULT_TRANSPORT_RATES: TransportRate[] = [
  { id: 't1', type: 'bus', pax_count: 1, rate_sar: 750 },
  { id: 't2', type: 'bus', pax_count: 2, rate_sar: 700 },
  { id: 't3', type: 'bus', pax_count: 3, rate_sar: 670 },
  { id: 't4', type: 'bus', pax_count: 4, rate_sar: 650 },
  { id: 't5', type: 'private', pax_count: 1, rate_sar: 900 },
  { id: 't6', type: 'private', pax_count: 2, rate_sar: 750 },
  { id: 't7', type: 'private', pax_count: 3, rate_sar: 700 },
  { id: 't8', type: 'private', pax_count: 4, rate_sar: 675 },
]

const DEFAULT_VISA: VisaSettings = {
  id: 'v1',
  visa_rate_1_pax: 725,
  visa_rate_2_pax: 700,
  visa_rate_3_pax: 675,
  visa_rate_4_pax: 650,
  visa_rate_group_pax: 600,
  child_sar: 600,
  infant_sar: 460,
  transport_mode: 'included',
  makkah_ziarat_rate: 0,
  madina_ziarat_rate: 0,
}
const DEFAULT_CURRENCY: CurrencySettings = { id: 'c1', sar_to_pkr: 75 }
const DEFAULT_COMPANY: Company = { id: 'co1', name: 'Fast Travels & Tours', license: 'Govt License', phone: '', website: 'fasttravels.pk', address: 'Pakistan', logo_url: '' }

const DEFAULT_STAFF: StaffUser[] = [
  { id: 'su1', name: 'Admin', username: 'admin', role: 'Admin', permission: 'Full Access', status: 'Active', created_at: new Date().toISOString() },
]

// Sample demo bookings to show data on first load
const today = new Date().toISOString().split('T')[0]
const DEFAULT_BOOKINGS: Booking[] = [
  {
    id: 'b1', created_at: new Date().toISOString(), booking_date: today,
    customer_name: 'Muhammad Ahmed', airline_name: 'Saudi Airlines',
    total_pkr: 285000, cost_pkr: 262500, profit_pkr: 22500,
    advance_pkr: 100000, paid_pkr: 100000, remaining_pkr: 185000,
    adult_count: 2, child_count: 0, infant_count: 0,
    makkah_hotel_name: 'Hilton Suites Makkah', makkah_hotel_location: 'Abraj Al-Bait', makkah_hotel_distance: '50-100 MTR', makkah_room_type: 'sharing', makkah_nights: 10,
    madinah_hotel_name: 'Anwar Al Madinah Mövenpick', madinah_hotel_location: 'Al Haram', madinah_hotel_distance: '50-100 MTR', madinah_room_type: 'sharing', madinah_nights: 7,
    created_by: 'su1',
  },
  {
    id: 'b2', created_at: new Date().toISOString(), booking_date: today,
    customer_name: 'Fatima Malik', airline_name: 'AirSial',
    total_pkr: 162000, cost_pkr: 150000, profit_pkr: 12000,
    advance_pkr: 162000, paid_pkr: 162000, remaining_pkr: 0,
    adult_count: 1, child_count: 0, infant_count: 0,
    makkah_hotel_name: 'Anjum Hotel Makkah', makkah_hotel_location: 'Al Haram', makkah_hotel_distance: '200-300 MTR', makkah_room_type: 'quad', makkah_nights: 8,
    madinah_hotel_name: 'Madinah Hilton Hotel', madinah_hotel_location: 'Al Haram', madinah_hotel_distance: '100-200 MTR', madinah_room_type: 'quad', madinah_nights: 5,
    created_by: 'su1',
  },
]

// ---------------------------------------------------------------------------
// Singleton store
// ---------------------------------------------------------------------------

const DEFAULT_HOTEL_VOUCHER_SETTINGS: HotelVoucherSettings = {
  id: 'hvs1',
  urdu_guidelines: [...DEFAULT_URDU_GUIDELINES],
  urdu_footer: DEFAULT_URDU_FOOTER,
}

class DemoStore {
  airlines: Airline[] = [...DEFAULT_AIRLINES]
  hotels: Hotel[] = [...DEFAULT_HOTELS]
  transportRates: TransportRate[] = [...DEFAULT_TRANSPORT_RATES]
  visa: VisaSettings = { ...DEFAULT_VISA }
  currency: CurrencySettings = { ...DEFAULT_CURRENCY }
  company: Company = { ...DEFAULT_COMPANY }
  bookings: Booking[] = [...DEFAULT_BOOKINGS]
  payments: Payment[] = []
  expenses: Expense[] = []
  staff: StaffUser[] = [...DEFAULT_STAFF]
  invoiceSettings: InvoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, id: 'is1' }
  hotelVoucherSettings: HotelVoucherSettings = { ...DEFAULT_HOTEL_VOUCHER_SETTINGS, urdu_guidelines: [...DEFAULT_URDU_GUIDELINES] }
  customInvoices: CustomInvoice[] = []
  hotelVouchers: HotelVoucherRecord[] = []
  invoiceCounter: number = 0
  voucherCounter: number = 0
  storageUsage: StorageUsage = { id: 'su1', total_bytes: 0, updated_at: new Date().toISOString() }

  private bumpStorage(bytes: number) {
    if (bytes <= 0) return
    this.storageUsage = {
      ...this.storageUsage,
      total_bytes: this.storageUsage.total_bytes + bytes,
      updated_at: new Date().toISOString(),
    }
  }

  private reduceStorage(bytes: number) {
    if (bytes <= 0) return
    this.storageUsage = {
      ...this.storageUsage,
      total_bytes: Math.max(0, this.storageUsage.total_bytes - bytes),
      updated_at: new Date().toISOString(),
    }
  }

  // Airlines
  upsertAirline(data: Omit<Airline, 'id'> & { id?: string }) {
    if (data.id) {
      this.airlines = this.airlines.map(a => a.id === data.id ? { ...a, ...data } : a)
    } else {
      const existing = this.airlines.findIndex(a => a.name.toLowerCase() === data.name.toLowerCase())
      if (existing >= 0) this.airlines[existing] = { ...this.airlines[existing], ...data }
      else this.airlines.push({ ...data, id: uid() })
    }
  }
  deleteAirline(id: string) { this.airlines = this.airlines.filter(a => a.id !== id) }

  // Hotels
  upsertHotel(data: Omit<Hotel, 'id'> & { id?: string }) {
    if (data.id) {
      this.hotels = this.hotels.map(h => h.id === data.id ? { ...h, ...data } : h)
    } else {
      const existing = this.hotels.findIndex(h =>
        h.name.toLowerCase() === data.name.toLowerCase() && h.city === data.city
      )
      if (existing >= 0) this.hotels[existing] = { ...this.hotels[existing], ...data }
      else this.hotels.push({ ...data, id: uid() })
    }
  }
  deleteHotel(id: string) { this.hotels = this.hotels.filter(h => h.id !== id) }

  // Bookings
  addBooking(data: Omit<Booking, 'id' | 'created_at'>) {
    const booking: Booking = { ...data, id: uid(), created_at: new Date().toISOString() }
    this.bookings = [booking, ...this.bookings]
    return booking
  }
  deleteBooking(id: string) {
    this.bookings = this.bookings.filter(b => b.id !== id)
    this.payments = this.payments.filter(p => p.booking_id !== id)
  }

  // Payments
  addPayment(data: Omit<Payment, 'id' | 'created_at'>) {
    const payment: Payment = { ...data, id: uid(), created_at: new Date().toISOString() }
    this.payments = [payment, ...this.payments]
    const booking = this.bookings.find(b => b.id === data.booking_id)
    if (booking) {
      booking.paid_pkr += data.amount_pkr
      booking.remaining_pkr = Math.max(0, booking.total_pkr - booking.paid_pkr)
    }
  }

  // Expenses
  addExpense(data: Omit<Expense, 'id' | 'created_at'>) {
    const expense: Expense = { ...data, id: uid(), created_at: new Date().toISOString() }
    this.expenses = [expense, ...this.expenses]
    return expense
  }
  deleteExpense(id: string) { this.expenses = this.expenses.filter(e => e.id !== id) }

  // Custom Invoices
  addCustomInvoice(
    data: Omit<CustomInvoice, 'created_at' | 'invoice_number'> & { invoice_number?: string },
  ): CustomInvoice {
    this.invoiceCounter++
    const invoice: CustomInvoice = {
      ...data,
      invoice_number: data.invoice_number ?? `ATI-${String(this.invoiceCounter).padStart(3, '0')}`,
      file_deleted_at: data.file_deleted_at ?? null,
      created_at: new Date().toISOString(),
    }
    if (invoice.file_size_bytes) this.bumpStorage(invoice.file_size_bytes)
    this.customInvoices = [invoice, ...this.customInvoices]
    return invoice
  }
  softDeleteInvoiceFile(id: string) {
    const inv = this.customInvoices.find(i => i.id === id)
    if (!inv || inv.file_deleted_at || !inv.storage_key) return
    demoFileStore.delete(inv.storage_key)
    this.reduceStorage(inv.file_size_bytes ?? 0)
    inv.file_deleted_at = new Date().toISOString()
  }
  deleteCustomInvoice(id: string) { this.customInvoices = this.customInvoices.filter(i => i.id !== id) }

  // Hotel Vouchers
  addHotelVoucher(
    data: Omit<HotelVoucherRecord, 'created_at' | 'voucher_number'> & { voucher_number?: string },
  ): HotelVoucherRecord {
    this.voucherCounter++
    const voucher: HotelVoucherRecord = {
      ...data,
      voucher_number: data.voucher_number ?? `HV-${String(this.voucherCounter).padStart(3, '0')}`,
      file_deleted_at: data.file_deleted_at ?? null,
      created_at: new Date().toISOString(),
    }
    if (voucher.file_size_bytes) this.bumpStorage(voucher.file_size_bytes)
    this.hotelVouchers = [voucher, ...this.hotelVouchers]
    return voucher
  }
  softDeleteVoucherFile(id: string) {
    const v = this.hotelVouchers.find(x => x.id === id)
    if (!v || v.file_deleted_at || !v.storage_key) return
    demoFileStore.delete(v.storage_key)
    this.reduceStorage(v.file_size_bytes ?? 0)
    v.file_deleted_at = new Date().toISOString()
  }
  updateInvoiceSettings(data: Partial<Omit<InvoiceSettings, 'id'>>) {
    this.invoiceSettings = { ...this.invoiceSettings, ...data, updated_at: new Date().toISOString() }
  }
  updateHotelVoucherSettings(data: Partial<Omit<HotelVoucherSettings, 'id'>>) {
    this.hotelVoucherSettings = {
      ...this.hotelVoucherSettings,
      ...data,
      urdu_guidelines: data.urdu_guidelines
        ? [...data.urdu_guidelines]
        : this.hotelVoucherSettings.urdu_guidelines,
      updated_at: new Date().toISOString(),
    }
  }

  // Staff
  addStaff(data: Omit<StaffUser, 'id' | 'created_at'>) {
    this.staff = [{ ...data, id: uid(), created_at: new Date().toISOString() }, ...this.staff]
  }
  updateStaff(id: string, data: Partial<StaffUser>) {
    this.staff = this.staff.map(s => s.id === id ? { ...s, ...data } : s)
  }
  deleteStaff(id: string) { this.staff = this.staff.filter(s => s.id !== id) }

  reset() {
    this.airlines = [...DEFAULT_AIRLINES]
    this.hotels = [...DEFAULT_HOTELS]
    this.transportRates = [...DEFAULT_TRANSPORT_RATES]
    this.visa = { ...DEFAULT_VISA }
    this.currency = { ...DEFAULT_CURRENCY }
    this.company = { ...DEFAULT_COMPANY }
    this.bookings = [...DEFAULT_BOOKINGS]
    this.payments = []
    this.expenses = []
    this.staff = [...DEFAULT_STAFF]
    this.invoiceSettings = { ...DEFAULT_INVOICE_SETTINGS }
    this.hotelVoucherSettings = { ...DEFAULT_HOTEL_VOUCHER_SETTINGS, urdu_guidelines: [...DEFAULT_URDU_GUIDELINES] }
    this.customInvoices = []
    this.hotelVouchers = []
    this.invoiceCounter = 0
    this.voucherCounter = 0
    this.storageUsage = { id: 'su1', total_bytes: 0, updated_at: new Date().toISOString() }
    demoFileStore.clear()
  }
}

// Bump this whenever DemoStore gains new fields, to force recreation in dev hot-reloads
const STORE_VERSION = 7

const globalStore = globalThis as typeof globalThis & {
  __demoStore?: DemoStore
  __demoStoreVersion?: number
}
if (!globalStore.__demoStore || globalStore.__demoStoreVersion !== STORE_VERSION) {
  globalStore.__demoStore = new DemoStore()
  globalStore.__demoStoreVersion = STORE_VERSION
}

export const demoStore = globalStore.__demoStore
