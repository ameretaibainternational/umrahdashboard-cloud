// Conflicting import removed

export interface VisaSettings {
  id: string
  visa_rate_1_pax: number      // 1 PAX
  visa_rate_2_pax: number      // 2 PAX
  visa_rate_3_pax: number      // 3 PAX
  visa_rate_4_pax: number      // 4 PAX
  visa_rate_group_pax: number  // 5–49 PAX
  child_sar: number
  infant_sar: number
  transport_mode: 'included' | 'separate'
  makkah_ziarat_rate: number   // flat group rate (SAR)
  madina_ziarat_rate: number   // flat group rate (SAR)
  badr_ziarat_rate: number     // Badr with Makkah ziarats (SAR)
  taif_ziarat_rate: number     // Taif with Madinah ziarats (SAR)
}

export interface ZiaratOption {
  id: string
  name: string
  slug: string | null
  rate_sar: number
  sort_order: number
  created_at?: string
}

export interface CurrencySettings {
  id: string
  sar_to_pkr: number
}

export interface TransportRate {
  id: string
  type: string
  pax_count: number
  rate_sar: number
}

export interface CustomTransport {
  id: string
  name: string
  rate_1_sar: number
  rate_2_sar: number
  rate_3_sar: number
  rate_4_sar: number
  sort_order: number
  created_at?: string
}

export interface Company {
  id: string
  name: string
  license: string
  phone: string
  website: string
  address: string
  logo_url: string
  pk_flight_cities?: string[]
  sa_flight_cities?: string[]
}

export interface Airline {
  id: string
  name: string
  adult_pkr: number
  child_pkr: number
  infant_pkr: number
}

export interface Hotel {
  id: string
  city: 'Makkah' | 'Madinah'
  name: string
  location: string
  distance: string
  contact_number?: string
  sharing_sar: number
  quad_sar: number
  triple_sar: number
  double_sar: number
  room_sar: number
}

export interface HotelContact {
  id: string
  name: string
  city: string
  contact_number: string
  created_at?: string
}

export interface TransportContact {
  id: string
  name: string
  city: string
  contact_number: string
  created_at?: string
}

export type RoomType = 'room' | 'sharing' | 'quad' | 'triple' | 'double'

export interface InvoicePaymentMethod {
  id: string
  label: string
  bank_name: string
  account_number: string
  created_at?: string
}

export interface InvoiceService {
  id: string
  name: string
  created_at?: string
}

export interface Booking {
  id: string
  created_at: string
  booking_date: string
  customer_name: string
  airline_name: string
  total_pkr: number
  cost_pkr: number
  profit_pkr: number
  advance_pkr: number
  paid_pkr: number
  remaining_pkr: number
  adult_count: number
  child_count: number
  infant_count: number
  makkah_hotel_name: string | null
  makkah_hotel_location: string | null
  makkah_hotel_distance: string | null
  makkah_room_type: string | null
  makkah_nights: number | null
  madinah_hotel_name: string | null
  madinah_hotel_location: string | null
  madinah_hotel_distance: string | null
  madinah_room_type: string | null
  madinah_nights: number | null
  created_by?: string | null
  source_invoice_id?: string | null
  /** Resolved from linked custom/package invoice when available */
  invoice_number?: string | null
}

export interface Payment {
  id: string
  created_at: string
  payment_date: string
  booking_id: string | null
  invoice_id?: string | null
  customer_name: string
  amount_pkr: number
  method: 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa'
  note: string
  created_by?: string | null
}

export type ExpenseType =
  | 'Umrah Supplier'
  | 'Airline / Ticket'
  | 'Hotel Supplier'
  | 'Transport Supplier'
  | 'Other Umrah Expense'

export interface Expense {
  id: string
  created_at: string
  expense_date: string
  expense_type: ExpenseType
  supplier: string
  amount_pkr: number
  method: 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa'
  note: string
  booking_id?: string | null
  invoice_id?: string | null
  created_by?: string | null
}

export interface StaffActivityStats {
  staff_id: string
  staff_name: string
  bookings: number
  custom_invoices: number
  hotel_vouchers: number
  payments: number
  expenses: number
}

export interface StaffUser {
  id: string
  name: string
  username: string
  role: StaffRole
  permission: StaffPermission
  status: 'Active' | 'Inactive'
  created_at: string
  email?: string
}

export type StaffRole = 'Admin' | 'Moderator' | 'Viewer'
export type StaffPermission = 'Full Access' | 'Moderator' | 'View Only'

// ── Custom Invoice ────────────────────────────────────────────────────────────

export interface InvoiceSettings {
  id: string
  payment_bank_name: string
  payment_account_number: string
  terms_text: string
  contact_phone: string
  contact_email: string
  contact_location: string
  updated_at?: string
}

export interface InvoiceClient {
  id: string
  name: string
  address: string
  client_number: string
  created_at?: string
}

export interface CustomInvoiceLineItem {
  service: string
  pax_price: number | null   // null = column hidden for this row
  pax_price_unit: string     // "SAR" | "PKR" | ""
  total_pax: number          // doubles as total_nights when night_price is active
  total: number
  total_unit: string
  received: number
  night_price: number | null // null = not active; mutually exclusive with pax_price
  night_price_unit: string   // "SAR" | "PKR" | ""
}

export interface PackageInvoiceData {
  adult: number
  child: number
  infant: number
  airlineId: string
  transportType: string
  makkahHotelId: string
  makkahRoom: RoomType
  makkahNights: number
  madinahHotelId: string
  madinahRoom: RoomType
  madinahNights: number
  profitType: 'percent' | 'fixed'
  profitValue: number
  sellingOverride: number | null
  advance: number
  customerName: string
  selectedZiaratIds?: string[]
  makkahZiarat?: boolean
  madinahZiarat?: boolean
  badrZiarat?: boolean
  taifZiarat?: boolean
  walkingZiarat?: boolean
  includeMakkahHotel: boolean
  includeMadinahHotel: boolean
  includeTickets: boolean
  includeTransport: boolean
  includeVisa: boolean
  customTicket: boolean
  customTicketLabel: string
  customTicketAmount: number
  customTicketCurrency: 'SAR' | 'PKR'
  travelDate: string
  departureCity: string
  arrivalCity: string
  saDepartureCity: string
  returnCity: string
  currencyUnit?: 'PKR' | 'SAR'
  sarToPkr?: number
  selectedTransportRouteIds?: string[]
  hidePricing?: boolean
  hideServiceCharges?: boolean
  profit_sar?: number
}

export interface TransportRoute {
  id: string
  name: string
  sort_order: number
  created_at?: string
}

export interface TransportVehicle {
  id: string
  name: string
  sort_order: number
  created_at?: string
}

export interface RouteVehicleRate {
  id: string
  route_id: string
  vehicle_id: string
  rate_sar: number
  created_at?: string
}

export interface CustomInvoice {
  id: string
  invoice_number: string     // ATI-001 or INV-20260626-1234
  invoice_date: string       // ISO date
  billed_to_name: string
  billed_to_address: string
  billed_to_client_number: string
  payment_bank_name: string
  payment_account_number: string
  terms_text: string
  contact_phone: string
  contact_email: string
  contact_location: string
  line_items: CustomInvoiceLineItem[]
  total: number
  received: number
  remaining: number
  profit_pkr?: number
  storage_key?: string | null
  file_size_bytes?: number | null
  file_deleted_at?: string | null
  created_at: string
  created_by?: string | null
  invoice_kind?: 'custom' | 'package'
  package_data?: PackageInvoiceData | null
  invoice_title_text?: string | null
}

export interface HotelVoucherRecord {
  id: string
  voucher_number: string
  voucher_date: string
  reference_no: string
  family_head: string
  package_info: string
  voucher_data: Record<string, unknown>
  storage_key?: string | null
  file_size_bytes?: number | null
  file_deleted_at?: string | null
  created_at: string
  created_by?: string | null
}

export interface StorageUsage {
  id: string
  total_bytes: number
  updated_at?: string
}

export type StoredFileType = 'invoice' | 'voucher'

export interface StoredFileRow {
  id: string
  type: StoredFileType
  number: string
  label: string
  date: string
  file_size_bytes: number
  created_at: string
}

export interface HotelVoucherSettings {
  id: string
  urdu_guidelines: string[]
  urdu_footer: string
  updated_at?: string
}

export interface CalcInput {
  adult: number
  child: number
  infant: number
  airline: Airline | null
  transportType: string
  makkahHotel: Hotel | null
  makkahRoom: RoomType
  makkahNights: number
  madinahHotel: Hotel | null
  madinahRoom: RoomType
  madinahNights: number
  profitType: 'percent' | 'fixed'
  profitValue: number
  sellingOverride: number | null
  advance: number
  customerName: string
  selectedZiaratIds: string[]
  includeMakkahHotel: boolean
  includeMadinahHotel: boolean
  includeTickets: boolean
  includeTransport?: boolean
  includeVisa?: boolean
  customTicket: boolean
  customTicketLabel: string   // airline name + route entered by user
  customTicketPkr: number     // total ticket cost already converted to PKR
  currencyUnit?: 'PKR' | 'SAR'
  customVisaPkr?: number
  selectedTransportRouteIds?: string[]
}

export interface ZiaratCalcItem {
  id: string
  name: string
  cost: number
}

export interface CalcResult {
  pax: number
  ticketCost: number
  visaCost: number
  transportCost: number
  makkahCost: number
  madinahCost: number
  ziaratItems: ZiaratCalcItem[]
  totalCost: number
  selling: number
  profit: number
  remaining: number
  perPax: number
}
