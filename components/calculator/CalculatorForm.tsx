'use client'

import { useState, useMemo, useRef, useTransition, useEffect, useId, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getCalc } from '@/lib/calculations'
import { pkr as fmtPkr } from '@/lib/formatters'
import { createBooking } from '@/app/actions/bookings'
import { upsertInvoiceClient } from '@/app/actions/settings'
import { createPackageInvoiceWithPdf, updatePackageInvoiceWithPdf } from '@/app/actions/package-invoices'
import { downloadCalculatorPdf, pdfDownloadHint } from '@/lib/storage-client'
import { uint8ToBase64 } from '@/lib/pdf-utils'
import { preloadCompanyLogo } from '@/lib/company-logo'
import { getPackageDataFromInvoice } from '@/lib/package-invoice'
import { buildPackageCustomInvoice, formatHotelForWhatsApp, formatRoute } from '@/lib/build-package-custom-invoice'
import { generateCustomInvoicePdfBytes } from '@/lib/generate-custom-invoice-pdf'
import { getNextPackageInvoiceNumber, resolveInvoiceSettings } from '@/lib/invoice-defaults'
import {
  clampInvoiceLogoPosition,
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOGO_X,
  DEFAULT_LOGO_Y,
  getLogoBoxSize,
  INTRINSIC_BG_H,
  INTRINSIC_BG_W,
  LOGO_MAX_BYTES,
  LOGO_SIZE_MAX,
  LOGO_SIZE_MIN,
  type InvoiceBranding,
} from '@/lib/custom-invoice-branding-layout'
import { BrandingSlider, BrandingResetButton } from '@/components/branding/BrandingSlider'
import { DEFAULT_PK_FLIGHT_CITIES, DEFAULT_SA_FLIGHT_CITIES } from '@/lib/flight-cities'
import { DEFAULT_TRANSPORT_VEHICLE, TRANSPORT_VEHICLES, type TransportVehicle } from '@/lib/transport'
import { resolveSelectedZiaratIds, ziaratLegacyFlags } from '@/lib/ziarats'
import type {
  Airline, Hotel, VisaSettings, CurrencySettings, TransportRate, RoomType, CalcInput,
  CustomInvoice, PackageInvoiceData, Company, InvoiceSettings, InvoiceClient, ZiaratOption,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BookmarkPlus, Copy, Download, Loader2, CheckCircle, Plus } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import CustomInvoiceTemplate from '@/components/custom-invoice/CustomInvoiceTemplate'
import InvoiceAppearanceControls from '@/components/custom-invoice/InvoiceAppearanceControls'
import {
  DEFAULT_INVOICE_TEXT_COLOR,
  DEFAULT_PACKAGE_INVOICE_BACKGROUND,
} from '@/lib/invoice-backgrounds'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  airlines: Airline[]
  makkahHotels: Hotel[]
  madinahHotels: Hotel[]
  visa: VisaSettings
  currency: CurrencySettings
  transportRates: TransportRate[]
  ziarats: ZiaratOption[]
  company: Company
  invoiceClients: InvoiceClient[]
  invoiceSettings: InvoiceSettings
  existingPackageInvoices?: CustomInvoice[]
  canSaveBooking?: boolean
  editInvoice?: CustomInvoice | null
}

function initialFromEdit(editInvoice?: CustomInvoice | null, ziarats: ZiaratOption[] = []): PackageInvoiceData | null {
  if (!editInvoice) return null
  return getPackageDataFromInvoice(editInvoice, ziarats)
}

function applyClientToBilled(client: InvoiceClient) {
  return {
    name: client.name,
    address: client.address,
    phone: client.client_number,
  }
}

const ROOM_TYPES: RoomType[] = ['room', 'sharing', 'quad', 'triple', 'double']

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read logo file'))
    reader.readAsDataURL(file)
  })
}

const PREVIEW_PAGE_H = 842

function ScaledPreview({ children, totalPages }: { children: React.ReactNode; totalPages: number }) {
  const CANVAS_W = 595.5
  const MAX_W = 340
  const GAP = 8
  const totalCanvasH = PREVIEW_PAGE_H * totalPages + GAP * (totalPages - 1)

  const outerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(MAX_W)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const update = (w: number) => setContainerW(Math.min(MAX_W, Math.max(160, w)))
    update(el.clientWidth)
    const obs = new ResizeObserver(entries => update(entries[0].contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const scale = containerW / CANVAS_W
  const scaledH = Math.round(totalCanvasH * scale)

  return (
    <div ref={outerRef} style={{ width: '100%' }}>
      <div style={{ width: containerW, height: scaledH, overflow: 'hidden', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CANVAS_W, height: totalCanvasH }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function CalculatorForm({
  airlines, makkahHotels, madinahHotels, visa, currency, transportRates, ziarats, company,
  invoiceClients,
  invoiceSettings,
  existingPackageInvoices = [],
  canSaveBooking = true,
  editInvoice = null,
}: Props) {
  const router = useRouter()
  const formId = useId()
  const printRef = useRef<HTMLDivElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const initial = initialFromEdit(editInvoice, ziarats)
  const resolvedSettings = resolveInvoiceSettings(invoiceSettings)
  const hasSavedClients = invoiceClients.length > 0
  const initialCustomerName = initial?.customerName ?? editInvoice?.billed_to_name ?? ''
  const matchedClient = invoiceClients.find(c => c.name === initialCustomerName)
  const initialBilled = editInvoice
    ? {
        name: editInvoice.billed_to_name,
        address: editInvoice.billed_to_address,
        phone: editInvoice.billed_to_client_number,
      }
    : matchedClient
      ? applyClientToBilled(matchedClient)
      : { name: initialCustomerName, address: '', phone: '' }

  const isExplicitEdit = Boolean(editInvoice?.id)

  const [invoiceNo, setInvoiceNo] = useState(() =>
    editInvoice?.invoice_number ?? getNextPackageInvoiceNumber(existingPackageInvoices),
  )
  const [invoiceTitleText, setInvoiceTitleText] = useState(() =>
    editInvoice?.invoice_title_text?.trim() || 'INVOICE',
  )
  const [pdfReady, setPdfReady] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(DEFAULT_LOGO_SIZE)
  const [logoX, setLogoX] = useState(DEFAULT_LOGO_X)
  const [logoY, setLogoY] = useState(DEFAULT_LOGO_Y)
  const [invoiceBackground, setInvoiceBackground] = useState(DEFAULT_PACKAGE_INVOICE_BACKGROUND)
  const [invoiceTextColor, setInvoiceTextColor] = useState(DEFAULT_INVOICE_TEXT_COLOR)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(editInvoice?.id ?? null)
  const [localSavedInvoices, setLocalSavedInvoices] = useState(existingPackageInvoices)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null)
  const [advancedAfterEdit, setAdvancedAfterEdit] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const [adult, setAdult] = useState(initial?.adult ?? 1)
  const [child, setChild] = useState(initial?.child ?? 0)
  const [infant, setInfant] = useState(initial?.infant ?? 0)
  const [airlineId, setAirlineId] = useState(initial?.airlineId || airlines[0]?.id || '')
  const [transportType, setTransportType] = useState<TransportVehicle>(initial?.transportType ?? DEFAULT_TRANSPORT_VEHICLE)
  const [makkahHotelId, setMakkahHotelId] = useState(initial?.makkahHotelId || makkahHotels[0]?.id || '')
  const [makkahRoom, setMakkahRoom] = useState<RoomType>(initial?.makkahRoom ?? 'sharing')
  const [makkahNights, setMakkahNights] = useState(initial?.makkahNights ?? 10)
  const [madinahHotelId, setMadinahHotelId] = useState(initial?.madinahHotelId || madinahHotels[0]?.id || '')
  const [madinahRoom, setMadinahRoom] = useState<RoomType>(initial?.madinahRoom ?? 'sharing')
  const [madinahNights, setMadinahNights] = useState(initial?.madinahNights ?? 10)
  const [includeMakkahHotel, setIncludeMakkahHotel] = useState(initial?.includeMakkahHotel ?? true)
  const [includeMadinahHotel, setIncludeMadinahHotel] = useState(initial?.includeMadinahHotel ?? true)
  const [includeTickets, setIncludeTickets] = useState(initial?.includeTickets ?? true)
  const [profitType, setProfitType] = useState<'percent' | 'fixed'>(initial?.profitType ?? 'percent')
  const [profitValue, setProfitValue] = useState(initial?.profitValue ?? 8)
  const [sellingOverride, setSellingOverride] = useState<number | null>(initial?.sellingOverride ?? null)
  const [advance, setAdvance] = useState(initial?.advance ?? 0)
  const [customerName, setCustomerName] = useState(initialBilled.name)
  const [billedAddr, setBilledAddr] = useState(initialBilled.address)
  const [billedPhone, setBilledPhone] = useState(initialBilled.phone)
  const [selectedClientId, setSelectedClientId] = useState(matchedClient?.id ?? invoiceClients[0]?.id ?? '')
  const [isNewCustomer, setIsNewCustomer] = useState(!hasSavedClients || !matchedClient)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerSaving, setNewCustomerSaving] = useState(false)
  const [selectedZiaratIds, setSelectedZiaratIds] = useState<string[]>(() =>
    resolveSelectedZiaratIds(initial, ziarats),
  )
  const [customTicket, setCustomTicket] = useState(initial?.customTicket ?? false)
  const [customTicketLabel, setCustomTicketLabel] = useState(initial?.customTicketLabel ?? '')
  const [customTicketAmount, setCustomTicketAmount] = useState(initial?.customTicketAmount ?? 0)
  const [customTicketCurrency, setCustomTicketCurrency] = useState<'SAR' | 'PKR'>(initial?.customTicketCurrency ?? 'SAR')
  const [travelDate, setTravelDate] = useState(initial?.travelDate ?? editInvoice?.invoice_date ?? '')
  const [departureCity, setDepartureCity] = useState(initial?.departureCity ?? '')
  const [arrivalCity, setArrivalCity] = useState(initial?.arrivalCity ?? '')
  const [saDepartureCity, setSaDepartureCity] = useState(initial?.saDepartureCity ?? '')
  const [returnCity, setReturnCity] = useState(initial?.returnCity ?? '')

  const pkCities = company.pk_flight_cities?.length ? company.pk_flight_cities : DEFAULT_PK_FLIGHT_CITIES
  const saCities = company.sa_flight_cities?.length ? company.sa_flight_cities : DEFAULT_SA_FLIGHT_CITIES

  const buildFormSnapshot = useCallback(() => JSON.stringify({
    invoiceTitleText,
    adult, child, infant, airlineId, transportType,
    makkahHotelId, makkahRoom, makkahNights,
    madinahHotelId, madinahRoom, madinahNights,
    includeMakkahHotel, includeMadinahHotel, includeTickets,
    profitType, profitValue, sellingOverride, advance,
    customerName, billedAddr, billedPhone,
    selectedZiaratIds,
    customTicket, customTicketLabel, customTicketAmount, customTicketCurrency,
    travelDate, departureCity, arrivalCity, saDepartureCity, returnCity,
  }), [
    invoiceTitleText, adult, child, infant, airlineId, transportType,
    makkahHotelId, makkahRoom, makkahNights, madinahHotelId, madinahRoom, madinahNights,
    includeMakkahHotel, includeMadinahHotel, includeTickets, profitType, profitValue, sellingOverride, advance,
    customerName, billedAddr, billedPhone,
    selectedZiaratIds,
    customTicket, customTicketLabel, customTicketAmount, customTicketCurrency,
    travelDate, departureCity, arrivalCity, saDepartureCity, returnCity,
  ])

  // After a save, any form change bumps to the next invoice number (new invoice on next save).
  useEffect(() => {
    if (isExplicitEdit || !lastSavedSnapshot || advancedAfterEdit) return
    if (buildFormSnapshot() === lastSavedSnapshot) return

    setSavedInvoiceId(null)
    setInvoiceNo(prev => getNextPackageInvoiceNumber([
      ...localSavedInvoices,
      { invoice_number: prev } as CustomInvoice,
    ]))
    setAdvancedAfterEdit(true)
  }, [
    buildFormSnapshot, lastSavedSnapshot, advancedAfterEdit, isExplicitEdit, localSavedInvoices,
  ])

  useEffect(() => {
    if (!editInvoice) {
      setInvoiceNo(prev => prev || getNextPackageInvoiceNumber(existingPackageInvoices))
    }
    let cancelled = false
    preloadCompanyLogo(company.logo_url).then(dataUrl => {
      if (cancelled) return
      setLogoUrl(dataUrl)
      setPdfReady(true)
    })
    return () => { cancelled = true }
  }, [company.logo_url, editInvoice, existingPackageInvoices])

  const logoBox = getLogoBoxSize(logoSize)
  const logoMaxX = Math.max(0, INTRINSIC_BG_W - logoBox.w)
  const logoMaxY = Math.max(0, INTRINSIC_BG_H - logoBox.h)

  function updateLogoSize(nextSize: number) {
    const size = Math.min(LOGO_SIZE_MAX, Math.max(LOGO_SIZE_MIN, nextSize))
    setLogoSize(size)
    const clamped = clampInvoiceLogoPosition(logoX, logoY, size)
    setLogoX(clamped.x)
    setLogoY(clamped.y)
  }

  function updateLogoX(nextX: number) {
    setLogoX(clampInvoiceLogoPosition(nextX, logoY, logoSize).x)
  }

  function updateLogoY(nextY: number) {
    setLogoY(clampInvoiceLogoPosition(logoX, nextY, logoSize).y)
  }

  function resetLogoDefaults() {
    setLogoSize(DEFAULT_LOGO_SIZE)
    setLogoX(DEFAULT_LOGO_X)
    setLogoY(DEFAULT_LOGO_Y)
  }

  const isDefaultLogo =
    logoSize === DEFAULT_LOGO_SIZE &&
    logoX === DEFAULT_LOGO_X &&
    logoY === DEFAULT_LOGO_Y

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      window.alert('Logo file must be 150 KB or smaller.')
      e.target.value = ''
      return
    }
    try {
      setLogoUrl(await readFileAsDataUrl(file))
    } catch {
      window.alert('Could not read logo file.')
      e.target.value = ''
    }
  }

  function clearLogo() {
    setLogoUrl(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  useEffect(() => {
    if (airlines.length > 0 && !airlines.some(a => a.id === airlineId)) {
      setAirlineId(airlines[0].id)
    }
  }, [airlines, airlineId])

  useEffect(() => {
    if (isNewCustomer || !hasSavedClients) return
    const client = invoiceClients.find(c => c.id === selectedClientId) ?? invoiceClients[0]
    if (!client) return
    if (client.id !== selectedClientId) setSelectedClientId(client.id)
    const billed = applyClientToBilled(client)
    setCustomerName(billed.name)
    setBilledAddr(billed.address)
    setBilledPhone(billed.phone)
  }, [invoiceClients, isNewCustomer, selectedClientId, hasSavedClients])

  function resolveOptionValue(current: string, options: { id: string }[]): string | null {
    return options.some(o => o.id === current) ? current : null
  }

  const airlineItems = useMemo(
    () => airlines.map(a => ({ value: a.id, label: a.name })),
    [airlines],
  )
  const makkahHotelItems = useMemo(
    () => makkahHotels.map(h => ({ value: h.id, label: `${h.name} · ${h.distance}` })),
    [makkahHotels],
  )
  const madinahHotelItems = useMemo(
    () => madinahHotels.map(h => ({ value: h.id, label: `${h.name} · ${h.distance}` })),
    [madinahHotels],
  )

  const customTicketPkr = customTicketCurrency === 'SAR'
    ? customTicketAmount * currency.sar_to_pkr
    : customTicketAmount

  const airline = airlines.find(a => a.id === airlineId) ?? null
  const makkahHotel = makkahHotels.find(h => h.id === makkahHotelId) ?? null
  const madinahHotel = madinahHotels.find(h => h.id === madinahHotelId) ?? null
  const airlineName = customTicket ? (customTicketLabel || 'Custom Ticket') : (airline?.name ?? '')

  const input: CalcInput = {
    adult, child, infant, airline, transportType,
    makkahHotel: includeMakkahHotel ? makkahHotel : null,
    makkahRoom, makkahNights,
    madinahHotel: includeMadinahHotel ? madinahHotel : null,
    madinahRoom, madinahNights,
    profitType, profitValue, sellingOverride, advance,
    customerName,
    selectedZiaratIds,
    includeMakkahHotel, includeMadinahHotel, includeTickets,
    customTicket, customTicketLabel, customTicketPkr,
  }

  const calc = useMemo(
    () => getCalc(input, transportRates, currency.sar_to_pkr, visa, visa.transport_mode, ziarats),
    [adult, child, infant, airlineId, transportType, makkahHotelId, makkahRoom, makkahNights,
     madinahHotelId, madinahRoom, madinahNights, profitType, profitValue, sellingOverride, advance,
     currency.sar_to_pkr,
     visa.visa_rate_1_pax, visa.visa_rate_2_pax, visa.visa_rate_3_pax,
     visa.visa_rate_4_pax, visa.visa_rate_group_pax,
     visa.infant_sar, visa.transport_mode,
     selectedZiaratIds,
     includeMakkahHotel, includeMadinahHotel, includeTickets,
     customTicket, customTicketPkr,
     transportRates, ziarats]
  )

  const branding: InvoiceBranding = useMemo(() => ({
    logoUrl,
    logoX,
    logoY,
    logoSize,
  }), [logoUrl, logoX, logoY, logoSize])

  const packageInvoice = useMemo(() => buildPackageCustomInvoice({
    invoiceNo: invoiceNo || 'INV-0000',
    invoiceDate: travelDate || new Date().toISOString().slice(0, 10),
    customerName: customerName || 'Walk-in Customer',
    billedToAddress: billedAddr,
    billedToClientNumber: billedPhone,
    advance,
    calc,
    adult, child, infant,
    airlineName,
    makkahHotel, makkahRoom, makkahNights,
    madinahHotel, madinahRoom, madinahNights,
    includeMakkahHotel, includeMadinahHotel, includeTickets,
    travelDate,
    transportType,
    company,
    invoiceSettings: resolvedSettings,
  }), [
    invoiceNo, travelDate, customerName, billedAddr, billedPhone, advance, calc,
    adult, child, infant, airlineName,
    makkahHotel, makkahRoom, makkahNights,
    madinahHotel, madinahRoom, madinahNights,
    includeMakkahHotel, includeMadinahHotel, includeTickets,
    transportType,
    company, resolvedSettings,
  ])

  const previewTotalPages = useMemo(() => {
    const count = packageInvoice.line_items.length
    return count <= 5 ? 1 : 1 + Math.ceil((count - 5) / 9)
  }, [packageInvoice.line_items.length])

  const generatePdfBytes = useCallback(async (): Promise<Uint8Array> => {
    const el = printRef.current
    if (!el) throw new Error('Invoice preview not ready.')
    return generateCustomInvoicePdfBytes(el, branding, invoiceBackground)
  }, [branding, invoiceBackground])

  function buildPackageData(): PackageInvoiceData {
    return {
      adult, child, infant, airlineId, transportType,
      makkahHotelId, makkahRoom, makkahNights,
      madinahHotelId, madinahRoom, madinahNights,
      profitType, profitValue, sellingOverride, advance,
      customerName,
      selectedZiaratIds,
      ...ziaratLegacyFlags(selectedZiaratIds, ziarats),
      includeMakkahHotel, includeMadinahHotel, includeTickets,
      customTicket, customTicketLabel, customTicketAmount, customTicketCurrency,
      travelDate, departureCity, arrivalCity, saDepartureCity, returnCity,
    }
  }

  function buildBookingPayload(sourceInvoiceId?: string | null) {
    return {
      customer_name: customerName || 'Walk-in Customer',
      airline_name: includeTickets ? (customTicket ? customTicketLabel : (airline?.name ?? '')) : '',
      total_pkr: calc.selling,
      cost_pkr: calc.totalCost,
      profit_pkr: calc.profit,
      advance_pkr: advance,
      paid_pkr: advance,
      remaining_pkr: calc.remaining,
      adult_count: adult,
      child_count: child,
      infant_count: infant,
      makkah_hotel_name: includeMakkahHotel ? (makkahHotel?.name ?? null) : null,
      makkah_hotel_location: includeMakkahHotel ? (makkahHotel?.location ?? null) : null,
      makkah_hotel_distance: includeMakkahHotel ? (makkahHotel?.distance ?? null) : null,
      makkah_room_type: includeMakkahHotel ? makkahRoom : null,
      makkah_nights: includeMakkahHotel ? makkahNights : null,
      madinah_hotel_name: includeMadinahHotel ? (madinahHotel?.name ?? null) : null,
      madinah_hotel_location: includeMadinahHotel ? (madinahHotel?.location ?? null) : null,
      madinah_hotel_distance: includeMadinahHotel ? (madinahHotel?.distance ?? null) : null,
      madinah_room_type: includeMadinahHotel ? madinahRoom : null,
      madinah_nights: includeMadinahHotel ? madinahNights : null,
      booking_date: travelDate || new Date().toISOString().slice(0, 10),
      auto_record_expense: true,
      source_invoice_id: sourceInvoiceId ?? savedInvoiceId ?? null,
    }
  }

  async function handleDownload() {
    setIsDownloading(true)
    try {
      const bytes = await generatePdfBytes()
      const billedName = customerName || 'Walk-in Customer'
      const filename = billedName !== 'Walk-in Customer'
        ? `${invoiceNo}_${billedName.trim().replace(/\s+/g, '_')}.pdf`
        : `${invoiceNo}.pdf`

      // Download immediately after PDF generation — before server save/booking —
      // so iPhone Safari still opens the file (async server calls break anchor downloads).
      const downloadMethod = await downloadCalculatorPdf(bytes, filename)

      const pdfBase64 = uint8ToBase64(bytes)
      const invoiceDate = travelDate || new Date().toISOString().slice(0, 10)
      const payload = {
        invoice_number: invoiceNo,
        invoice_date: invoiceDate,
        billed_to_name: billedName,
        billed_to_address: billedAddr,
        billed_to_client_number: billedPhone,
        total: calc.selling,
        received: advance,
        remaining: calc.remaining,
        package_data: buildPackageData(),
        pdf_base64: pdfBase64,
        contact_phone: resolvedSettings.contact_phone || company.phone,
        contact_email: resolvedSettings.contact_email || company.website,
        contact_location: resolvedSettings.contact_location || company.address,
        invoice_title_text: invoiceTitleText.trim() || 'INVOICE',
      }

      const isUpdate = isExplicitEdit
        ? Boolean(savedInvoiceId)
        : Boolean(savedInvoiceId) && !advancedAfterEdit
      const persist = () => (
        isUpdate
          ? updatePackageInvoiceWithPdf({ id: savedInvoiceId!, ...payload })
          : createPackageInvoiceWithPdf(payload)
      )

      let result
      try {
        result = await persist()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const transient = msg.includes('unexpected response') || msg.includes('Failed to fetch') || msg.includes('NetworkError')
        if (!transient) throw err
        result = await persist()
      }

      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }

      if ('id' in result && result.id && 'invoice_number' in result) {
        if (isUpdate) {
          setSavedInvoiceId(result.id)
        } else {
          setSavedInvoiceId(result.id)
          setLocalSavedInvoices(prev => [
            ...prev,
            { invoice_number: result.invoice_number } as CustomInvoice,
          ])
        }
        setLastSavedSnapshot(buildFormSnapshot())
        setAdvancedAfterEdit(false)
      }

      if (canSaveBooking) {
        const linkedInvoiceId = ('id' in result && result.id) ? result.id : savedInvoiceId
        const bookingResult = await createBooking(buildBookingPayload(linkedInvoiceId))
        if ('error' in bookingResult && bookingResult.error) {
          toast.error(`Invoice saved but booking failed: ${bookingResult.error}`)
          return
        }
      }

      const iosHint = pdfDownloadHint(downloadMethod)
      toast.success(
        iosHint
          ? (canSaveBooking
            ? `Booking created and invoice saved. ${iosHint}`
            : (isUpdate ? `Invoice updated. ${iosHint}` : `Invoice saved. ${iosHint}`))
          : (canSaveBooking
            ? 'Booking created, invoice saved and downloaded.'
            : (isUpdate ? 'Invoice updated and downloaded.' : 'Invoice saved and downloaded.')),
      )
      router.refresh()
    } catch (err) {
      console.error('[PDF] calculator invoice failed:', err)
      toast.error(`Could not save invoice: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleSave() {
    startTransition(async () => {
      const result = await createBooking(buildBookingPayload())

      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking saved successfully!')
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  function handleClientSelect(id: string) {
    setSelectedClientId(id)
    const client = invoiceClients.find(c => c.id === id)
    if (!client) return
    const billed = applyClientToBilled(client)
    setCustomerName(billed.name)
    setBilledAddr(billed.address)
    setBilledPhone(billed.phone)
  }

  function handleNewCustomerChange(checked: boolean) {
    setIsNewCustomer(checked)
    if (!checked && hasSavedClients) {
      const client = invoiceClients.find(c => c.id === selectedClientId) ?? invoiceClients[0]
      handleClientSelect(client.id)
      return
    }
    if (checked) {
      setCustomerName('')
      setBilledAddr('')
      setBilledPhone('')
    }
  }

  async function handleSaveNewCustomer(formData: FormData) {
    setNewCustomerSaving(true)
    try {
      const result = await upsertInvoiceClient(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      const name = String(formData.get('name') ?? '').trim()
      const address = String(formData.get('address') ?? '').trim()
      const phone = String(formData.get('client_number') ?? '').trim()
      setCustomerName(name)
      setBilledAddr(address)
      setBilledPhone(phone)
      setIsNewCustomer(false)
      setNewCustomerOpen(false)
      toast.success('Customer saved!')
      router.refresh()
    } finally {
      setNewCustomerSaving(false)
    }
  }

  function handleCopyWhatsApp() {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    const totalNights = (includeMakkahHotel ? makkahNights : 0) + (includeMadinahHotel ? madinahNights : 0)
    const formattedDate = travelDate
      ? new Date(travelDate + 'T00:00:00').toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
      : null
    const paxParts = [
      adult  > 0 ? `${adult} Adult${adult > 1 ? 's' : ''}`     : '',
      child  > 0 ? `${child} Child${child > 1 ? 'ren' : ''}`   : '',
      infant > 0 ? `${infant} Infant${infant > 1 ? 's' : ''}`  : '',
    ].filter(Boolean).join(', ')
    const contact = company.phone
      ? `🟢 Contact: ${company.phone}`
      : company.website
        ? `🌐 Website: ${company.website}`
        : ''
    const route = formatRoute(departureCity, arrivalCity, saDepartureCity, returnCity)

    const lines: string[] = [
      `🏷️ *${company.name}*`,
      `🕋 *${totalNights || makkahNights + madinahNights} Nights Umrah Package*`,
      ``,
      ...(formattedDate ? [`📅 Travel Date: ${formattedDate}`] : []),
      ...(route !== '—' ? [`✈️ Route: ${route}`] : []),
      ...(includeTickets && airlineName ? [`🛫 Airline: ${airlineName}`] : []),
      ``,
      `👤 Passengers: ${paxParts}`,
      ``,
    ]

    if (includeMakkahHotel) {
      lines.push(
        `🏨 *Makkah Hotel*`,
        formatHotelForWhatsApp(makkahHotel),
        `🛏️ ${cap(makkahRoom)} Room | 🌙 ${makkahNights} Nights`,
        ``,
      )
    }

    if (includeMadinahHotel) {
      lines.push(
        `🏨 *Madinah Hotel*`,
        formatHotelForWhatsApp(madinahHotel),
        `🛏️ ${cap(madinahRoom)} Room | 🌙 ${madinahNights} Nights`,
        ``,
      )
    }

    for (const item of calc.ziaratItems) {
      const suffix = item.cost > 0 ? 'Included' : 'Included (Free)'
      lines.push(`🚌 ${item.name}: ${suffix}`)
    }
    if (calc.ziaratItems.length > 0) lines.push(``)

    lines.push(
      `💰 *Package Price: ${fmtPkr(calc.selling)}*`,
      `💰 Per Person: ${fmtPkr(calc.perPax)}`,
      ``,
      ...(contact ? [contact] : []),
    )

    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('WhatsApp message copied!')
  }

  const rows = [
    ...(includeTickets ? [{ label: 'Tickets', value: fmtPkr(calc.ticketCost) }] : []),
    { label: 'Visa', value: fmtPkr(calc.visaCost) },
    { label: `Transport (${transportType})`, value: fmtPkr(calc.transportCost) },
    ...(includeMakkahHotel ? [{ label: `Makkah Hotel (${makkahNights}N)`, value: fmtPkr(calc.makkahCost) }] : []),
    ...(includeMadinahHotel ? [{ label: `Madinah Hotel (${madinahNights}N)`, value: fmtPkr(calc.madinahCost) }] : []),
    ...calc.ziaratItems.map(item => ({
      label: item.name,
      value: item.cost > 0 ? fmtPkr(item.cost) : 'Free',
    })),
  ]

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-5">
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Passengers
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              {[
                { label: 'Adults', value: adult, set: setAdult },
                { label: 'Children', value: child, set: setChild },
                { label: 'Infants', value: infant, set: setInfant },
              ].map(({ label, value, set }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number" min={0} max={20} value={value}
                    onChange={e => set(Math.max(0, parseInt(e.target.value) || 0))}
                    className="text-center font-semibold"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Flight & Transport
                </CardTitle>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={includeTickets}
                    onCheckedChange={v => setIncludeTickets(Boolean(v))}
                  />
                  <span className="text-xs font-normal normal-case">Include Flight Tickets</span>
                </label>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {includeTickets && (
              <>
              <label className="col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={customTicket}
                  onCheckedChange={v => setCustomTicket(Boolean(v))}
                />
                <span className="text-sm">Custom Ticket</span>
              </label>

              {customTicket ? (
                <>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Airline / Route</Label>
                    <Input
                      placeholder="e.g. PIA — LHR to JED"
                      value={customTicketLabel}
                      onChange={e => setCustomTicketLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Ticket Price</Label>
                      <div className="flex rounded-md overflow-hidden border text-xs">
                        {(['SAR', 'PKR'] as const).map(cur => (
                          <button
                            key={cur}
                            type="button"
                            onClick={() => setCustomTicketCurrency(cur)}
                            className={`px-2.5 py-0.5 font-semibold transition-colors ${
                              customTicketCurrency === cur
                                ? 'bg-navy text-white'
                                : 'bg-white text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      type="number" min={0}
                      value={customTicketAmount || ''}
                      placeholder="0"
                      onChange={e => setCustomTicketAmount(parseFloat(e.target.value) || 0)}
                    />
                    {customTicketAmount > 0 && customTicketCurrency === 'SAR' && (
                      <p className="text-xs text-muted-foreground">
                        = {fmtPkr(customTicketPkr)}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Airline</Label>
                  {airlines.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
                      No airlines found. Add airlines in Settings first.
                    </p>
                  ) : (
                    <Select
                      items={airlineItems}
                      value={resolveOptionValue(airlineId, airlines)}
                      onValueChange={v => { if (v) setAirlineId(v) }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select airline" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[var(--anchor-width)] w-[var(--anchor-width)]">
                        {airlines.map(a => (
                          <SelectItem key={a.id} value={a.id} label={a.name}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Departure (Pakistan)</Label>
                <Select value={departureCity} onValueChange={v => v && setDepartureCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {pkCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Arrival (Saudi Arabia)</Label>
                <Select value={arrivalCity} onValueChange={v => v && setArrivalCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {saCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Departure (Saudi Arabia)</Label>
                <Select value={saDepartureCity} onValueChange={v => v && setSaDepartureCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {saCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Return Arrival (Pakistan)</Label>
                <Select value={returnCity} onValueChange={v => v && setReturnCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {pkCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Transport</Label>
                <Select value={transportType} onValueChange={v => v && setTransportType(v as TransportVehicle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_VEHICLES.map(vehicle => (
                      <SelectItem key={vehicle} value={vehicle}>{vehicle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {(['Makkah', 'Madinah'] as const).map(city => {
            const isM = city === 'Makkah'
            const hotelId = isM ? makkahHotelId : madinahHotelId
            const setHotelId = isM ? setMakkahHotelId : setMadinahHotelId
            const room = isM ? makkahRoom : madinahRoom
            const setRoom = isM ? setMakkahRoom : setMadinahRoom
            const nights = isM ? makkahNights : madinahNights
            const setNights = isM ? setMakkahNights : setMadinahNights
            const hotels = isM ? makkahHotels : madinahHotels
            const hotelItems = isM ? makkahHotelItems : madinahHotelItems
            const included = isM ? includeMakkahHotel : includeMadinahHotel
            const setIncluded = isM ? setIncludeMakkahHotel : setIncludeMadinahHotel

            return (
              <Card key={city} className="shadow-sm border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {city} Hotel
                    </CardTitle>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={included}
                        onCheckedChange={v => setIncluded(Boolean(v))}
                      />
                      <span className="text-xs font-normal normal-case">Include {city} Hotel</span>
                    </label>
                  </div>
                </CardHeader>
                {included && (
                  <CardContent className="grid grid-cols-3 gap-4">
                    <div className="col-span-3 space-y-1.5">
                      <Label className="text-xs">Hotel</Label>
                      <Select
                        items={hotelItems}
                        value={resolveOptionValue(hotelId, hotels)}
                        onValueChange={v => { if (v) setHotelId(v) }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select hotel" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[var(--anchor-width)] w-[var(--anchor-width)]">
                          {hotels.map(h => (
                            <SelectItem key={h.id} value={h.id} label={h.name} className="py-2">
                              <span className="font-medium">{h.name}</span>
                              <span className="text-muted-foreground text-xs ml-1.5">· {h.distance}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Room Type</Label>
                      <Select value={room} onValueChange={v => v && setRoom(v as RoomType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROOM_TYPES.map(r => (
                            <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Nights</Label>
                      <Input
                        type="number" min={1} max={30} value={nights}
                        onChange={e => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ziarats
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ziarats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ziarats configured. Add them in Settings → Ziarats.</p>
              ) : ziarats.map(z => (
                <label key={z.id} className="flex items-center gap-3 cursor-pointer select-none">
                  <Checkbox
                    checked={selectedZiaratIds.includes(z.id)}
                    onCheckedChange={v => {
                      const checked = Boolean(v)
                      setSelectedZiaratIds(prev =>
                        checked ? [...new Set([...prev, z.id])] : prev.filter(id => id !== z.id),
                      )
                    }}
                  />
                  <span className="text-sm">
                    {z.name}
                    {z.rate_sar > 0 ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({fmtPkr(z.rate_sar * currency.sar_to_pkr)})
                      </span>
                    ) : (
                      <span className="ml-1.5 text-xs text-muted-foreground">(Free)</span>
                    )}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Profit Type</Label>
                <Select value={profitType} onValueChange={v => setProfitType(v as 'percent' | 'fixed')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage %</SelectItem>
                    <SelectItem value="fixed">Fixed PKR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{profitType === 'percent' ? 'Profit %' : 'Profit PKR'}</Label>
                <Input
                  type="number" min={0} value={profitValue}
                  onChange={e => setProfitValue(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Selling Price Override</Label>
                <Input
                  type="number" min={0} placeholder="Leave blank for auto"
                  value={sellingOverride ?? ''}
                  onChange={e => setSellingOverride(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Advance Received</Label>
                <Input
                  type="number" min={0} value={advance}
                  onChange={e => setAdvance(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Number</Label>
                <Input
                  placeholder="INV-1501"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Title</Label>
                <Input
                  placeholder="INVOICE"
                  value={invoiceTitleText}
                  onChange={e => setInvoiceTitleText(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Invoice Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceAppearanceControls
                backgroundSrc={invoiceBackground}
                onBackgroundChange={setInvoiceBackground}
                textColor={invoiceTextColor}
                onTextColorChange={setInvoiceTextColor}
                defaultBackground={DEFAULT_PACKAGE_INVOICE_BACKGROUND}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Logo stays in your browser only until you download — not stored on the server. Company logo loads by default; upload to replace it.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Logo Upload (max 150 KB)</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="h-9 text-xs cursor-pointer"
                  />
                  {logoUrl && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={clearLogo}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {logoUrl && (
                <div className="space-y-3 pt-2 border-t border-dashed">
                  <BrandingSlider
                    label="Logo Size (width)"
                    value={logoSize}
                    min={LOGO_SIZE_MIN}
                    max={LOGO_SIZE_MAX}
                    onChange={updateLogoSize}
                  />
                  <BrandingSlider
                    label="Logo X Position"
                    value={logoX}
                    min={0}
                    max={logoMaxX}
                    onChange={updateLogoX}
                  />
                  <BrandingSlider
                    label="Logo Y Position"
                    value={logoY}
                    min={0}
                    max={logoMaxY}
                    onChange={updateLogoY}
                  />
                  <BrandingResetButton
                    onReset={resetLogoDefaults}
                    disabled={isDefaultLogo}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-3">
                {hasSavedClients && (
                  <>
                    {!isNewCustomer && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Customer</Label>
                        <select
                          value={selectedClientId}
                          onChange={e => handleClientSelect(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {invoiceClients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`${formId}-new-customer`}
                          checked={isNewCustomer}
                          onCheckedChange={v => handleNewCustomerChange(Boolean(v))}
                        />
                        <Label htmlFor={`${formId}-new-customer`} className="text-xs cursor-pointer">New customer</Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setNewCustomerOpen(true)}
                      >
                        <Plus className="w-3 h-3" />
                        Add customer
                      </Button>
                    </div>
                  </>
                )}
                {(isNewCustomer || !hasSavedClients) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer Name</Label>
                    <Input
                      placeholder="Walk-in Customer"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Travel Date</Label>
                <Input
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 min-w-0 xl:sticky xl:top-6 xl:self-start xl:z-10">
          <Card className="shadow-sm border-0 bg-navy text-white">
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-white/200 text-xs uppercase tracking-wide mb-1">Package Total</p>
                <p className="text-3xl font-bold text-gold">{fmtPkr(calc.selling)}</p>
                <p className="text-white/100 text-xs mt-1">
                  Per person: {fmtPkr(calc.perPax)} · {calc.pax} pax
                </p>
              </div>

              <Separator className="bg-white/10" />

              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-white/60">{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                ))}
                <Separator className="bg-white/10" />
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Total Cost</span>
                  <span className="font-medium">{fmtPkr(calc.totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm text-gold">
                  <span>Profit</span>
                  <span className="font-semibold">{fmtPkr(calc.profit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Advance</span>
                  <span>{fmtPkr(advance)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Remaining</span>
                  <span className="text-gold">{fmtPkr(calc.remaining)}</span>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                {canSaveBooking && (
                  <Button
                    onClick={handleSave}
                    disabled={isPending || saved}
                    className="w-full bg-gold-gradient hover:brightness-110 text-navy font-semibold h-10"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4 mr-2" /> : <BookmarkPlus className="w-4 h-4 mr-2" />}
                    {saved ? 'Saved!' : 'Save Booking'}
                  </Button>
                )}
                {canSaveBooking && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCopyWhatsApp}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownload}
                      disabled={isDownloading || !pdfReady || !invoiceNo}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {isDownloading ? 'Saving…' : editInvoice ? 'Update & Download' : 'Save & Download'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {pdfReady && (
            <Card className="shadow-sm border-0 relative z-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Live Preview
                  {previewTotalPages > 1 && (
                    <span className="text-muted-foreground/60 font-normal normal-case tracking-normal ml-1">
                      ({previewTotalPages} pages)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScaledPreview totalPages={previewTotalPages}>
                  <CustomInvoiceTemplate
                    invoice={packageInvoice}
                    branding={branding}
                    titleText={invoiceTitleText.trim() || 'INVOICE'}
                    titleFontSize={38}
                    titleTop={22}
                    invoiceIdY={92}
                    dateY={109.5}
                    centerInvoiceId
                    backgroundImage={invoiceBackground}
                    textColor={invoiceTextColor}
                  />
                </ScaledPreview>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Updates as you change package details, customer info, and logo settings.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <form action={handleSaveNewCustomer} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input name="name" required placeholder="Customer name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input name="address" placeholder="Address" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Number</Label>
              <Input name="client_number" placeholder="+92 300 0000000" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewCustomerOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={newCustomerSaving} className="bg-navy hover:bg-navy-2 text-white">
                {newCustomerSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {pdfReady && (
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none' }}>
          <CustomInvoiceTemplate
            ref={printRef}
            invoice={packageInvoice}
            branding={branding}
            titleText={invoiceTitleText.trim() || 'INVOICE'}
            titleFontSize={38}
            titleTop={22}
            invoiceIdY={92}
            dateY={109.5}
            centerInvoiceId
            backgroundImage={invoiceBackground}
            textColor={invoiceTextColor}
          />
        </div>
      )}
    </>
  )
}
