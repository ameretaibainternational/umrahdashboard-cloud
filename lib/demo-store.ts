import type { Airline, Hotel, Booking, Payment, Expense, StaffUser, VisaSettings, CurrencySettings, TransportRate, Company, InvoiceSettings, InvoiceClient, InvoicePaymentMethod, InvoiceService, CustomInvoice, HotelVoucherSettings, HotelVoucherRecord, StorageUsage, ZiaratOption, HotelContact, TransportContact, CustomTransport, TransportRoute, TransportVehicle, RouteVehicleRate } from './types'
import { DEFAULT_TRANSPORT_RATE_SAR, TRANSPORT_VEHICLES, transportServiceName } from './transport'
import { DEFAULT_ZIARAT_SEED } from './ziarats'
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
  { id: 'h1', city: 'Makkah', name: 'Hilton Suites Makkah', location: 'Abraj Al-Bait', distance: '50-100 MTR', sharing_sar: 450, quad_sar: 550, triple_sar: 700, double_sar: 950, contact_number: '', room_sar: 0 },
  { id: 'h2', city: 'Makkah', name: 'Swissotel Makkah', location: 'Abraj Al-Bait', distance: '50-100 MTR', sharing_sar: 420, quad_sar: 520, triple_sar: 670, double_sar: 920, contact_number: '', room_sar: 0 },
  { id: 'h3', city: 'Makkah', name: 'Pullman ZamZam Makkah', location: 'Abraj Al-Bait', distance: '100-200 MTR', sharing_sar: 350, quad_sar: 450, triple_sar: 600, double_sar: 850, contact_number: '', room_sar: 0 },
  { id: 'h4', city: 'Makkah', name: 'Anjum Hotel Makkah', location: 'Al Haram', distance: '200-300 MTR', sharing_sar: 300, quad_sar: 400, triple_sar: 550, double_sar: 800, contact_number: '', room_sar: 0 },
  { id: 'h5', city: 'Makkah', name: 'Al Safwah Royale Orchid', location: 'Al Haram', distance: '300-400 MTR', sharing_sar: 250, quad_sar: 350, triple_sar: 500, double_sar: 750, contact_number: '', room_sar: 0 },
  { id: 'h6', city: 'Makkah', name: 'Dar Al Taqwa Hotel', location: 'Al Haram', distance: '200 MTR', sharing_sar: 280, quad_sar: 380, triple_sar: 530, double_sar: 780, contact_number: '', room_sar: 0 },
  { id: 'h7', city: 'Makkah', name: 'Sheraton Makkah Jabal Al Kaaba', location: 'Al Haram', distance: '500 MTR', sharing_sar: 240, quad_sar: 340, triple_sar: 490, double_sar: 740, contact_number: '', room_sar: 0 },
  { id: 'h8', city: 'Makkah', name: 'Grand Millennium Makkah', location: 'Al Haram', distance: '700-800 MTR', sharing_sar: 180, quad_sar: 280, triple_sar: 430, double_sar: 680, contact_number: '', room_sar: 0 },
  { id: 'h9', city: 'Makkah', name: 'Al Rayyan Hotel Makkah', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 100, quad_sar: 200, triple_sar: 350, double_sar: 600, contact_number: '', room_sar: 0 },
  { id: 'h10', city: 'Makkah', name: 'Rawaq Hotel Makkah', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 90, quad_sar: 190, triple_sar: 340, double_sar: 590, contact_number: '', room_sar: 0 },
  { id: 'h11', city: 'Madinah', name: 'Anwar Al Madinah Mövenpick', location: 'Al Haram', distance: '50-100 MTR', sharing_sar: 300, quad_sar: 400, triple_sar: 550, double_sar: 800, contact_number: '', room_sar: 0 },
  { id: 'h12', city: 'Madinah', name: 'Madinah Hilton Hotel', location: 'Al Haram', distance: '100-200 MTR', sharing_sar: 280, quad_sar: 380, triple_sar: 530, double_sar: 780, contact_number: '', room_sar: 0 },
  { id: 'h13', city: 'Madinah', name: 'Al Shohada Hotel', location: 'Al Haram', distance: '100 MTR', sharing_sar: 260, quad_sar: 360, triple_sar: 510, double_sar: 760, contact_number: '', room_sar: 0 },
  { id: 'h14', city: 'Madinah', name: 'Pullman Zamzam Madinah', location: 'Al Haram', distance: '300 MTR', sharing_sar: 220, quad_sar: 320, triple_sar: 470, double_sar: 720, contact_number: '', room_sar: 0 },
  { id: 'h15', city: 'Madinah', name: 'Oberoi Madinah', location: 'Al Haram', distance: '400 MTR', sharing_sar: 350, quad_sar: 450, triple_sar: 600, double_sar: 850, contact_number: '', room_sar: 0 },
  { id: 'h16', city: 'Madinah', name: 'Al Eiman Royal Hotel', location: 'Al Haram', distance: '600-700 MTR', sharing_sar: 150, quad_sar: 250, triple_sar: 400, double_sar: 650, contact_number: '', room_sar: 0 },
  { id: 'h17', city: 'Madinah', name: 'Dallah Taibah Hotel', location: 'Al Haram', distance: '1 KM', sharing_sar: 120, quad_sar: 220, triple_sar: 370, double_sar: 620, contact_number: '', room_sar: 0 },
  { id: 'h18', city: 'Madinah', name: 'Saja Al Madinah Hotel', location: 'Al Haram', distance: 'Shuttle Service', sharing_sar: 100, quad_sar: 200, triple_sar: 350, double_sar: 600, contact_number: '', room_sar: 0 },
]

const DEFAULT_INVOICE_CLIENTS: InvoiceClient[] = [
  { id: 'ic1', name: 'ATIQ TRAVEL & TOURS', address: 'DUBAI', client_number: '+971 50 000 0000' },
]

const DEFAULT_INVOICE_PAYMENT_METHODS: InvoicePaymentMethod[] = [
  { id: 'pm1', label: 'Meezan Bank', bank_name: 'Meezan Bank', account_number: '01234567890123' },
]

const DEFAULT_INVOICE_SERVICES: InvoiceService[] = [
  { id: 'sv1', name: '03 MONTH UMRAH VISA' },
  { id: 'sv2', name: 'UMRAH PACKAGE' },
  ...TRANSPORT_VEHICLES.map((vehicle, i) => ({
    id: `sv-transport-${i + 1}`,
    name: transportServiceName(vehicle),
  })),
]

const DEFAULT_TRANSPORT_RATES: TransportRate[] = TRANSPORT_VEHICLES.flatMap((type, vi) =>
  ([1, 2, 3, 4] as const).map((pax_count, pi) => ({
    id: `t${vi * 4 + pi + 1}`,
    type,
    pax_count,
    rate_sar: DEFAULT_TRANSPORT_RATE_SAR[type][pax_count - 1],
  }))
)

const DEFAULT_ZIARATS: ZiaratOption[] = DEFAULT_ZIARAT_SEED.map((seed, i) => ({
  id: `z${i + 1}`,
  ...seed,
}))

const DEFAULT_HOTEL_CONTACTS: HotelContact[] = []

const DEFAULT_TRANSPORT_VEHICLES: TransportVehicle[] = [
  { id: 'v1', name: 'CAR', sort_order: 1 },
  { id: 'v2', name: 'H1', sort_order: 2 },
  { id: 'v3', name: 'STARIA', sort_order: 3 },
  { id: 'v4', name: 'GMC', sort_order: 4 },
  { id: 'v5', name: 'HIACE', sort_order: 5 },
  { id: 'v6', name: 'COASTER', sort_order: 6 },
]

const DEFAULT_TRANSPORT_ROUTES: TransportRoute[] = [
  { id: 'r1', name: 'JED TO MAK', sort_order: 1 },
  { id: 'r2', name: 'MAK TO JED', sort_order: 2 },
  { id: 'r3', name: 'MAK TO MED / MED TO MAK', sort_order: 3 },
  { id: 'r4', name: 'MAK ZIYARAT', sort_order: 4 },
  { id: 'r5', name: 'MED ZIYARAT', sort_order: 5 },
  { id: 'r6', name: 'MED HTL TO MED APT', sort_order: 6 },
  { id: 'r7', name: 'MED HTL TO JED APT', sort_order: 7 },
]

const DEFAULT_ROUTE_VEHICLE_RATES: RouteVehicleRate[] = [
  { id: 'rvr1', route_id: 'r1', vehicle_id: 'v1', rate_sar: 230 },
  { id: 'rvr2', route_id: 'r1', vehicle_id: 'v2', rate_sar: 280 },
  { id: 'rvr3', route_id: 'r1', vehicle_id: 'v3', rate_sar: 280 },
  { id: 'rvr4', route_id: 'r1', vehicle_id: 'v4', rate_sar: 430 },
  { id: 'rvr5', route_id: 'r1', vehicle_id: 'v5', rate_sar: 330 },
  { id: 'rvr6', route_id: 'r1', vehicle_id: 'v6', rate_sar: 530 },

  { id: 'rvr7', route_id: 'r2', vehicle_id: 'v1', rate_sar: 180 },
  { id: 'rvr8', route_id: 'r2', vehicle_id: 'v2', rate_sar: 230 },
  { id: 'rvr9', route_id: 'r2', vehicle_id: 'v3', rate_sar: 230 },
  { id: 'rvr10', route_id: 'r2', vehicle_id: 'v4', rate_sar: 380 },
  { id: 'rvr11', route_id: 'r2', vehicle_id: 'v5', rate_sar: 280 },
  { id: 'rvr12', route_id: 'r2', vehicle_id: 'v6', rate_sar: 455 },

  { id: 'rvr13', route_id: 'r3', vehicle_id: 'v1', rate_sar: 365 },
  { id: 'rvr14', route_id: 'r3', vehicle_id: 'v2', rate_sar: 455 },
  { id: 'rvr15', route_id: 'r3', vehicle_id: 'v3', rate_sar: 455 },
  { id: 'rvr16', route_id: 'r3', vehicle_id: 'v4', rate_sar: 930 },
  { id: 'rvr17', route_id: 'r3', vehicle_id: 'v5', rate_sar: 555 },
  { id: 'rvr18', route_id: 'r3', vehicle_id: 'v6', rate_sar: 855 },

  { id: 'rvr19', route_id: 'r4', vehicle_id: 'v1', rate_sar: 180 },
  { id: 'rvr20', route_id: 'r4', vehicle_id: 'v2', rate_sar: 230 },
  { id: 'rvr21', route_id: 'r4', vehicle_id: 'v3', rate_sar: 230 },
  { id: 'rvr22', route_id: 'r4', vehicle_id: 'v4', rate_sar: 380 },
  { id: 'rvr23', route_id: 'r4', vehicle_id: 'v5', rate_sar: 330 },
  { id: 'rvr24', route_id: 'r4', vehicle_id: 'v6', rate_sar: 405 },

  { id: 'rvr25', route_id: 'r5', vehicle_id: 'v1', rate_sar: 180 },
  { id: 'rvr26', route_id: 'r5', vehicle_id: 'v2', rate_sar: 230 },
  { id: 'rvr27', route_id: 'r5', vehicle_id: 'v3', rate_sar: 230 },
  { id: 'rvr28', route_id: 'r5', vehicle_id: 'v4', rate_sar: 380 },
  { id: 'rvr29', route_id: 'r5', vehicle_id: 'v5', rate_sar: 330 },
  { id: 'rvr30', route_id: 'r5', vehicle_id: 'v6', rate_sar: 405 },

  { id: 'rvr31', route_id: 'r6', vehicle_id: 'v1', rate_sar: 130 },
  { id: 'rvr32', route_id: 'r6', vehicle_id: 'v2', rate_sar: 130 },
  { id: 'rvr33', route_id: 'r6', vehicle_id: 'v3', rate_sar: 130 },
  { id: 'rvr34', route_id: 'r6', vehicle_id: 'v4', rate_sar: 330 },
  { id: 'rvr35', route_id: 'r6', vehicle_id: 'v5', rate_sar: 180 },
  { id: 'rvr36', route_id: 'r6', vehicle_id: 'v6', rate_sar: 305 },

  { id: 'rvr37', route_id: 'r7', vehicle_id: 'v1', rate_sar: 330 },
  { id: 'rvr38', route_id: 'r7', vehicle_id: 'v2', rate_sar: 405 },
  { id: 'rvr39', route_id: 'r7', vehicle_id: 'v3', rate_sar: 405 },
  { id: 'rvr40', route_id: 'r7', vehicle_id: 'v4', rate_sar: 830 },
  { id: 'rvr41', route_id: 'r7', vehicle_id: 'v5', rate_sar: 505 },
  { id: 'rvr42', route_id: 'r7', vehicle_id: 'v6', rate_sar: 805 },
]

const DEFAULT_VISA: VisaSettings = {
  id: 'v1',
  visa_rate_1_pax: 725,
  visa_rate_2_pax: 700,
  visa_rate_3_pax: 675,
  visa_rate_4_pax: 650,
  visa_rate_5_pax: 625,
  visa_rate_group_pax: 600,
  child_sar: 600,
  infant_sar: 460,
  transport_mode: 'included',
  makkah_ziarat_rate: 0,
  madina_ziarat_rate: 0,
  badr_ziarat_rate: 0,
  taif_ziarat_rate: 0,
}
const DEFAULT_CURRENCY: CurrencySettings = { id: 'c1', sar_to_pkr: 75 }
const DEFAULT_COMPANY: Company = {
  id: 'co1',
  name: 'Fast Travels & Tours',
  license: 'Govt License',
  phone: '',
  website: 'fasttravels.pk',
  address: 'Pakistan',
  logo_url: '',
  pk_flight_cities: ['Islamabad', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Sialkot', 'Faisalabad', 'Quetta'],
  sa_flight_cities: ['Jeddah', 'Madinah', 'Riyadh', 'Dammam'],
}

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
  customTransports: CustomTransport[] = []
  transportRoutes: TransportRoute[] = [...DEFAULT_TRANSPORT_ROUTES]
  transportVehicles: TransportVehicle[] = [...DEFAULT_TRANSPORT_VEHICLES]
  routeVehicleRates: RouteVehicleRate[] = [...DEFAULT_ROUTE_VEHICLE_RATES]
  ziarats: ZiaratOption[] = [...DEFAULT_ZIARATS]
  hotelContacts: HotelContact[] = [...DEFAULT_HOTEL_CONTACTS]
  transportContacts: TransportContact[] = []
  visa: VisaSettings = { ...DEFAULT_VISA }
  currency: CurrencySettings = { ...DEFAULT_CURRENCY }
  company: Company = { ...DEFAULT_COMPANY }
  bookings: Booking[] = [...DEFAULT_BOOKINGS]
  payments: Payment[] = []
  expenses: Expense[] = []
  staff: StaffUser[] = [...DEFAULT_STAFF]
  invoiceSettings: InvoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, id: 'is1' }
  invoiceClients: InvoiceClient[] = [...DEFAULT_INVOICE_CLIENTS]
  invoicePaymentMethods: InvoicePaymentMethod[] = [...DEFAULT_INVOICE_PAYMENT_METHODS]
  invoiceServices: InvoiceService[] = [...DEFAULT_INVOICE_SERVICES]
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

  setStorageUsage(total_bytes: number) {
    this.storageUsage = {
      ...this.storageUsage,
      total_bytes: Math.max(0, total_bytes),
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

  // Invoice clients (Billed To)
  upsertInvoiceClient(data: Omit<InvoiceClient, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.invoiceClients = this.invoiceClients.map(c =>
        c.id === data.id ? { ...c, ...data } : c,
      )
    } else {
      this.invoiceClients.push({
        id: uid(),
        name: data.name,
        address: data.address,
        client_number: data.client_number,
        created_at: new Date().toISOString(),
      })
    }
  }
  deleteInvoiceClient(id: string) {
    this.invoiceClients = this.invoiceClients.filter(c => c.id !== id)
  }

  upsertInvoicePaymentMethod(data: Omit<InvoicePaymentMethod, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.invoicePaymentMethods = this.invoicePaymentMethods.map(m =>
        m.id === data.id ? { ...m, ...data } : m,
      )
    } else {
      this.invoicePaymentMethods.push({
        id: uid(),
        label: data.label,
        bank_name: data.bank_name,
        account_number: data.account_number,
        created_at: new Date().toISOString(),
      })
    }
  }
  deleteInvoicePaymentMethod(id: string) {
    this.invoicePaymentMethods = this.invoicePaymentMethods.filter(m => m.id !== id)
  }

  upsertInvoiceService(data: Omit<InvoiceService, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.invoiceServices = this.invoiceServices.map(s =>
        s.id === data.id ? { ...s, ...data } : s,
      )
    } else {
      const existing = this.invoiceServices.findIndex(s => s.name.toLowerCase() === data.name.toLowerCase())
      if (existing >= 0) {
        this.invoiceServices[existing] = { ...this.invoiceServices[existing], name: data.name }
      } else {
        this.invoiceServices.push({
          id: uid(),
          name: data.name,
          created_at: new Date().toISOString(),
        })
      }
    }
  }
  deleteInvoiceService(id: string) {
    this.invoiceServices = this.invoiceServices.filter(s => s.id !== id)
  }

  upsertZiarat(data: Omit<ZiaratOption, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.ziarats = this.ziarats.map(z =>
        z.id === data.id ? { ...z, ...data } : z,
      )
    } else {
      const nextOrder = this.ziarats.reduce((max, z) => Math.max(max, z.sort_order), 0) + 1
      this.ziarats.push({
        id: uid(),
        name: data.name,
        slug: data.slug ?? null,
        rate_sar: data.rate_sar,
        sort_order: data.sort_order || nextOrder,
        created_at: new Date().toISOString(),
      })
    }
  }
  deleteZiarat(id: string) {
    this.ziarats = this.ziarats.filter(z => z.id !== id)
  }

  upsertCustomTransport(data: Omit<CustomTransport, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.customTransports = this.customTransports.map(t =>
        t.id === data.id ? { ...t, ...data } : t,
      )
    } else {
      const nextOrder = this.customTransports.reduce((max, t) => Math.max(max, t.sort_order), 0) + 1
      this.customTransports.push({
        id: uid(),
        name: data.name,
        rate_1_sar: data.rate_1_sar,
        rate_2_sar: data.rate_2_sar,
        rate_3_sar: data.rate_3_sar,
        rate_4_sar: data.rate_4_sar,
        sort_order: data.sort_order || nextOrder,
        created_at: new Date().toISOString(),
      })
    }
  }
  deleteCustomTransport(id: string) {
    this.customTransports = this.customTransports.filter(t => t.id !== id)
  }

  upsertHotelContact(data: Omit<HotelContact, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.hotelContacts = this.hotelContacts.map(c =>
        c.id === data.id ? { ...c, ...data } : c,
      )
    } else {
      const existing = this.hotelContacts.findIndex(c =>
        c.name.toLowerCase() === data.name.toLowerCase() && c.city.toLowerCase() === data.city.toLowerCase(),
      )
      if (existing >= 0) {
        this.hotelContacts[existing] = { ...this.hotelContacts[existing], ...data }
      } else {
        this.hotelContacts.push({
          id: uid(),
          name: data.name,
          city: data.city,
          contact_number: data.contact_number,
          created_at: new Date().toISOString(),
        })
      }
    }
  }
  deleteHotelContact(id: string) {
    this.hotelContacts = this.hotelContacts.filter(c => c.id !== id)
  }
  upsertTransportContact(data: Omit<TransportContact, 'id' | 'created_at'> & { id?: string }) {
    if (data.id) {
      this.transportContacts = this.transportContacts.map(c =>
        c.id === data.id ? { ...c, ...data } : c,
      )
    } else {
      const existing = this.transportContacts.findIndex(c =>
        c.name.toLowerCase() === data.name.toLowerCase() && c.city.toLowerCase() === data.city.toLowerCase(),
      )
      if (existing >= 0) {
        this.transportContacts[existing] = { ...this.transportContacts[existing], ...data }
      } else {
        this.transportContacts.push({
          id: uid(),
          name: data.name,
          city: data.city,
          contact_number: data.contact_number,
          created_at: new Date().toISOString(),
        })
      }
    }
  }
  deleteTransportContact(id: string) {
    this.transportContacts = this.transportContacts.filter(c => c.id !== id)
  }

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
    this.expenses = this.expenses.filter(e => e.booking_id !== id)
  }
  updateBooking(id: string, data: Partial<Omit<Booking, 'id' | 'created_at' | 'created_by'>>) {
    const booking = this.bookings.find(b => b.id === id)
    if (!booking) return null
    Object.assign(booking, data)
    return booking
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

  /** Ledger entry only — booking totals already set (e.g. advance at booking creation). */
  addPaymentRecord(data: Omit<Payment, 'id' | 'created_at'>) {
    const payment: Payment = { ...data, id: uid(), created_at: new Date().toISOString() }
    this.payments = [payment, ...this.payments]
    return payment
  }

  deletePaymentsForBooking(bookingId: string) {
    this.payments = this.payments.filter(p => p.booking_id !== bookingId)
    const booking = this.bookings.find(b => b.id === bookingId)
    if (booking) {
      booking.paid_pkr = 0
      booking.remaining_pkr = booking.total_pkr
    }
  }

  // Expenses
  addExpense(data: Omit<Expense, 'id' | 'created_at'>) {
    const expense: Expense = { ...data, id: uid(), created_at: new Date().toISOString() }
    this.expenses = [expense, ...this.expenses]
    return expense
  }
  deleteExpense(id: string) { this.expenses = this.expenses.filter(e => e.id !== id) }
  deleteExpensesForInvoice(invoiceId: string) {
    this.expenses = this.expenses.filter(e => e.invoice_id !== invoiceId)
  }

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
  updateCustomInvoice(id: string, data: Partial<Omit<CustomInvoice, 'id' | 'created_at' | 'created_by'>>) {
    const inv = this.customInvoices.find(i => i.id === id)
    if (!inv) return null
    const oldSize = inv.file_size_bytes ?? 0
    Object.assign(inv, data)
    if (data.file_size_bytes != null && data.file_size_bytes !== oldSize) {
      this.reduceStorage(oldSize)
      this.bumpStorage(data.file_size_bytes)
    }
    return inv
  }
  deleteCustomInvoice(id: string) {
    const inv = this.customInvoices.find(i => i.id === id)
    if (inv?.storage_key && !inv.file_deleted_at) {
      demoFileStore.delete(inv.storage_key)
      this.reduceStorage(inv.file_size_bytes ?? 0)
    }
    this.customInvoices = this.customInvoices.filter(i => i.id !== id)
    this.payments = this.payments.filter(p => (p as any).invoice_id !== id)
  }

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
  updateHotelVoucher(id: string, data: Partial<Omit<HotelVoucherRecord, 'id' | 'created_at' | 'voucher_number'>>) {
    const idx = this.hotelVouchers.findIndex(v => v.id === id)
    if (idx !== -1) {
      const existing = this.hotelVouchers[idx]
      const oldSize = existing.file_size_bytes ?? 0
      const newSize = data.file_size_bytes ?? oldSize
      if (oldSize !== newSize) {
        this.reduceStorage(oldSize)
        this.bumpStorage(newSize)
      }
      this.hotelVouchers[idx] = {
        ...existing,
        ...data,
      } as HotelVoucherRecord
    }
  }
  deleteHotelVoucher(id: string) {
    const v = this.hotelVouchers.find(x => x.id === id)
    if (v?.storage_key && !v.file_deleted_at) {
      demoFileStore.delete(v.storage_key)
      this.reduceStorage(v.file_size_bytes ?? 0)
    }
    this.hotelVouchers = this.hotelVouchers.filter(x => x.id !== id)
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

  // Transport Routes CRUD
  upsertTransportRoute(data: { id?: string; name: string; sort_order: number }) {
    if (data.id) {
      this.transportRoutes = this.transportRoutes.map(r => r.id === data.id ? { ...r, ...data } : r)
    } else {
      const id = uid()
      this.transportRoutes.push({ id, ...data })
    }
  }
  deleteTransportRoute(id: string) {
    this.transportRoutes = this.transportRoutes.filter(r => r.id !== id)
    this.routeVehicleRates = this.routeVehicleRates.filter(r => r.route_id !== id)
  }

  // Transport Vehicles CRUD
  upsertTransportVehicle(data: { id?: string; name: string; sort_order: number }) {
    if (data.id) {
      this.transportVehicles = this.transportVehicles.map(v => v.id === data.id ? { ...v, ...data } : v)
    } else {
      const id = uid()
      this.transportVehicles.push({ id, ...data })
    }
  }
  deleteTransportVehicle(id: string) {
    this.transportVehicles = this.transportVehicles.filter(v => v.id !== id)
    this.routeVehicleRates = this.routeVehicleRates.filter(r => r.vehicle_id !== id)
  }

  // Route Vehicle Rates Grid Update
  updateRouteVehicleRates(rates: { route_id: string; vehicle_id: string; rate_sar: number }[]) {
    for (const item of rates) {
      const idx = this.routeVehicleRates.findIndex(r => r.route_id === item.route_id && r.vehicle_id === item.vehicle_id)
      if (idx !== -1) {
        this.routeVehicleRates[idx].rate_sar = Number(item.rate_sar)
      } else {
        this.routeVehicleRates.push({
          id: uid(),
          route_id: item.route_id,
          vehicle_id: item.vehicle_id,
          rate_sar: Number(item.rate_sar)
        })
      }
    }
  }

  reset() {
    this.airlines = [...DEFAULT_AIRLINES]
    this.hotels = [...DEFAULT_HOTELS]
    this.transportRates = [...DEFAULT_TRANSPORT_RATES]
    this.transportRoutes = [...DEFAULT_TRANSPORT_ROUTES]
    this.transportVehicles = [...DEFAULT_TRANSPORT_VEHICLES]
    this.routeVehicleRates = [...DEFAULT_ROUTE_VEHICLE_RATES]
    this.ziarats = [...DEFAULT_ZIARATS]
    this.hotelContacts = [...DEFAULT_HOTEL_CONTACTS]
    this.visa = { ...DEFAULT_VISA }
    this.currency = { ...DEFAULT_CURRENCY }
    this.company = { ...DEFAULT_COMPANY }
    this.bookings = [...DEFAULT_BOOKINGS]
    this.payments = []
    this.expenses = []
    this.staff = [...DEFAULT_STAFF]
    this.invoiceSettings = { ...DEFAULT_INVOICE_SETTINGS }
    this.invoiceClients = [...DEFAULT_INVOICE_CLIENTS]
    this.invoicePaymentMethods = [...DEFAULT_INVOICE_PAYMENT_METHODS]
    this.invoiceServices = [...DEFAULT_INVOICE_SERVICES]
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
const STORE_VERSION = 12

const globalStore = globalThis as typeof globalThis & {
  __demoStore?: DemoStore
  __demoStoreVersion?: number
}
if (!globalStore.__demoStore || globalStore.__demoStoreVersion !== STORE_VERSION) {
  globalStore.__demoStore = new DemoStore()
  globalStore.__demoStoreVersion = STORE_VERSION
}

export const demoStore = globalStore.__demoStore
