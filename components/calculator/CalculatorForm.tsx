'use client'

import { useState, useMemo, useRef, useTransition, useEffect, useId, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getCalc, generateInvoiceNumber } from '@/lib/calculations'
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
import { resolveInvoiceSettings } from '@/lib/invoice-defaults'
import {
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOGO_X,
  DEFAULT_LOGO_Y,
  type InvoiceBranding,
} from '@/lib/custom-invoice-branding-layout'
import { DEFAULT_PK_FLIGHT_CITIES, DEFAULT_SA_FLIGHT_CITIES } from '@/lib/flight-cities'
import type {
  Airline, Hotel, VisaSettings, CurrencySettings, TransportRate, RoomType, CalcInput,
  CustomInvoice, PackageInvoiceData, Company, InvoiceSettings, InvoiceClient,
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

const PACKAGE_INVOICE_BG = '/invoice-empty-package-calculator.jpg'
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
  company: Company
  invoiceClients: InvoiceClient[]
  invoiceSettings: InvoiceSettings
  canSaveBooking?: boolean
  editInvoice?: CustomInvoice | null
}

function initialFromEdit(editInvoice?: CustomInvoice | null): PackageInvoiceData | null {
  if (!editInvoice) return null
  return getPackageDataFromInvoice(editInvoice)
}

function applyClientToBilled(client: InvoiceClient) {
  return {
    name: client.name,
    address: client.address,
    phone: client.client_number,
  }
}

const ROOM_TYPES: RoomType[] = ['room', 'sharing', 'quad', 'triple', 'double']

export default function CalculatorForm({
  airlines, makkahHotels, madinahHotels, visa, currency, transportRates, company,
  invoiceClients,
  invoiceSettings,
  canSaveBooking = true,
  editInvoice = null,
}: Props) {
  const router = useRouter()
  const formId = useId()
  const printRef = useRef<HTMLDivElement>(null)
  const initial = initialFromEdit(editInvoice)
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

  const [invoiceNo, setInvoiceNo] = useState(() => editInvoice?.invoice_number ?? '')
  const [pdfReady, setPdfReady] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(editInvoice?.id ?? null)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const [adult, setAdult] = useState(initial?.adult ?? 1)
  const [child, setChild] = useState(initial?.child ?? 0)
  const [infant, setInfant] = useState(initial?.infant ?? 0)
  const [airlineId, setAirlineId] = useState(initial?.airlineId || airlines[0]?.id || '')
  const [transportType, setTransportType] = useState<'bus' | 'private'>(initial?.transportType ?? 'bus')
  const [makkahHotelId, setMakkahHotelId] = useState(initial?.makkahHotelId || makkahHotels[0]?.id || '')
  const [makkahRoom, setMakkahRoom] = useState<RoomType>(initial?.makkahRoom ?? 'sharing')
  const [makkahNights, setMakkahNights] = useState(initial?.makkahNights ?? 10)
  const [madinahHotelId, setMadinahHotelId] = useState(initial?.madinahHotelId || madinahHotels[0]?.id || '')
  const [madinahRoom, setMadinahRoom] = useState<RoomType>(initial?.madinahRoom ?? 'sharing')
  const [madinahNights, setMadinahNights] = useState(initial?.madinahNights ?? 10)
  const [includeMakkahHotel, setIncludeMakkahHotel] = useState(initial?.includeMakkahHotel ?? true)
  const [includeMadinahHotel, setIncludeMadinahHotel] = useState(initial?.includeMadinahHotel ?? true)
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
  const [makkahZiarat, setMakkahZiarat] = useState(initial?.makkahZiarat ?? false)
  const [madinahZiarat, setMadinahZiarat] = useState(initial?.madinahZiarat ?? false)
  const [badrZiarat, setBadrZiarat] = useState(initial?.badrZiarat ?? false)
  const [taifZiarat, setTaifZiarat] = useState(initial?.taifZiarat ?? false)
  const [walkingZiarat, setWalkingZiarat] = useState(initial?.walkingZiarat ?? false)
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

  useEffect(() => {
    setInvoiceNo(prev => prev || generateInvoiceNumber())
    let cancelled = false
    preloadCompanyLogo(company.logo_url).then(dataUrl => {
      if (cancelled) return
      setLogoDataUrl(dataUrl)
      setPdfReady(true)
    })
    return () => { cancelled = true }
  }, [company.logo_url])

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
    makkahZiarat, madinahZiarat, badrZiarat, taifZiarat, walkingZiarat,
    includeMakkahHotel, includeMadinahHotel,
    customTicket, customTicketLabel, customTicketPkr,
  }

  const calc = useMemo(
    () => getCalc(input, transportRates, currency.sar_to_pkr, visa, visa.transport_mode),
    [adult, child, infant, airlineId, transportType, makkahHotelId, makkahRoom, makkahNights,
     madinahHotelId, madinahRoom, madinahNights, profitType, profitValue, sellingOverride, advance,
     currency.sar_to_pkr,
     visa.visa_rate_1_pax, visa.visa_rate_2_pax, visa.visa_rate_3_pax,
     visa.visa_rate_4_pax, visa.visa_rate_group_pax,
     visa.infant_sar, visa.transport_mode,
     visa.makkah_ziarat_rate, visa.madina_ziarat_rate,
     visa.badr_ziarat_rate, visa.taif_ziarat_rate,
     makkahZiarat, madinahZiarat, badrZiarat, taifZiarat,
     includeMakkahHotel, includeMadinahHotel,
     customTicket, customTicketPkr,
     transportRates]
  )

  const branding: InvoiceBranding = useMemo(() => ({
    logoUrl: logoDataUrl,
    logoX: DEFAULT_LOGO_X,
    logoY: DEFAULT_LOGO_Y,
    logoSize: DEFAULT_LOGO_SIZE,
  }), [logoDataUrl])

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
    makkahZiarat, madinahZiarat, badrZiarat, taifZiarat, walkingZiarat,
    includeMakkahHotel, includeMadinahHotel,
    travelDate,
    company,
    invoiceSettings: resolvedSettings,
  }), [
    invoiceNo, travelDate, customerName, billedAddr, billedPhone, advance, calc,
    adult, child, infant, airlineName,
    makkahHotel, makkahRoom, makkahNights,
    madinahHotel, madinahRoom, madinahNights,
    makkahZiarat, madinahZiarat, badrZiarat, taifZiarat, walkingZiarat,
    includeMakkahHotel, includeMadinahHotel,
    company, resolvedSettings,
  ])

  const generatePdfBytes = useCallback(async (): Promise<Uint8Array> => {
    const el = printRef.current
    if (!el) throw new Error('Invoice preview not ready.')
    return generateCustomInvoicePdfBytes(el, branding, PACKAGE_INVOICE_BG)
  }, [branding])

  function buildPackageData(): PackageInvoiceData {
    return {
      adult, child, infant, airlineId, transportType,
      makkahHotelId, makkahRoom, makkahNights,
      madinahHotelId, madinahRoom, madinahNights,
      profitType, profitValue, sellingOverride, advance,
      customerName,
      makkahZiarat, madinahZiarat, badrZiarat, taifZiarat, walkingZiarat,
      includeMakkahHotel, includeMadinahHotel,
      customTicket, customTicketLabel, customTicketAmount, customTicketCurrency,
      travelDate, departureCity, arrivalCity, saDepartureCity, returnCity,
    }
  }

  function buildBookingPayload() {
    return {
      customer_name: customerName || 'Walk-in Customer',
      airline_name: customTicket ? customTicketLabel : (airline?.name ?? ''),
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
      }

      const isUpdate = Boolean(savedInvoiceId)
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

      if (!isUpdate && 'id' in result && result.id) setSavedInvoiceId(result.id)

      if (canSaveBooking) {
        const bookingResult = await createBooking(buildBookingPayload())
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
      ? `📞 Contact: ${company.phone}`
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
      ...(airlineName ? [`🛫 Airline: ${airlineName}`] : []),
      ``,
      `👤 Passengers: ${paxParts}`,
      ``,
    ]

    if (includeMakkahHotel) {
      lines.push(
        `🏨 *Makkah Hotel*`,
        formatHotelForWhatsApp(makkahHotel),
        `🛏️ ${cap(makkahRoom)} Room | 🌙 ${makkahNights} Nights`,
      )
      if (makkahZiarat) lines.push(`🚌 Makkah Ziarats: Included`)
      if (badrZiarat) lines.push(`🚌 Badr Ziarat: Included`)
      lines.push(``)
    }

    if (includeMadinahHotel) {
      lines.push(
        `🏨 *Madinah Hotel*`,
        formatHotelForWhatsApp(madinahHotel),
        `🛏️ ${cap(madinahRoom)} Room | 🌙 ${madinahNights} Nights`,
      )
      if (madinahZiarat) lines.push(`🚌 Madinah Ziarats: Included`)
      if (taifZiarat) lines.push(`🚌 Taif Ziarat: Included`)
      lines.push(``)
    }

    if (walkingZiarat) lines.push(`🚶 Walking Ziarats: Included (Free)`, ``)

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
    { label: 'Tickets', value: fmtPkr(calc.ticketCost) },
    { label: 'Visa', value: fmtPkr(calc.visaCost) },
    { label: visa.transport_mode === 'included' ? 'Transport (Included)' : 'Transport', value: visa.transport_mode === 'included' ? '—' : fmtPkr(calc.transportCost) },
    ...(includeMakkahHotel ? [{ label: `Makkah Hotel (${makkahNights}N)`, value: fmtPkr(calc.makkahCost) }] : []),
    ...(includeMadinahHotel ? [{ label: `Madinah Hotel (${madinahNights}N)`, value: fmtPkr(calc.madinahCost) }] : []),
    ...(makkahZiarat ? [{ label: 'Makkah Ziarats', value: fmtPkr(calc.makkahZiaratCost) }] : []),
    ...(madinahZiarat ? [{ label: 'Madina Ziarats', value: fmtPkr(calc.madinahZiaratCost) }] : []),
    ...(badrZiarat ? [{ label: 'Badr Ziarat', value: fmtPkr(calc.badrZiaratCost) }] : []),
    ...(taifZiarat ? [{ label: 'Taif Ziarat', value: fmtPkr(calc.taifZiaratCost) }] : []),
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
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Flight & Transport
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
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

              {visa.transport_mode === 'separate' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Transport</Label>
                  <Select value={transportType} onValueChange={v => v && setTransportType(v as 'bus' | 'private')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bus">Bus</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox checked={makkahZiarat} onCheckedChange={v => setMakkahZiarat(Boolean(v))} />
                <span className="text-sm">
                  Include Makkah Ziarats
                  {visa.makkah_ziarat_rate > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtPkr(visa.makkah_ziarat_rate * currency.sar_to_pkr)})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox checked={madinahZiarat} onCheckedChange={v => setMadinahZiarat(Boolean(v))} />
                <span className="text-sm">
                  Include Madinah Ziarats
                  {visa.madina_ziarat_rate > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtPkr(visa.madina_ziarat_rate * currency.sar_to_pkr)})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox checked={badrZiarat} onCheckedChange={v => setBadrZiarat(Boolean(v))} />
                <span className="text-sm">
                  Badr Ziarat
                  {visa.badr_ziarat_rate > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtPkr(visa.badr_ziarat_rate * currency.sar_to_pkr)})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox checked={taifZiarat} onCheckedChange={v => setTaifZiarat(Boolean(v))} />
                <span className="text-sm">
                  Taif Ziarat
                  {visa.taif_ziarat_rate > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtPkr(visa.taif_ziarat_rate * currency.sar_to_pkr)})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox checked={walkingZiarat} onCheckedChange={v => setWalkingZiarat(Boolean(v))} />
                <span className="text-sm">Walking Ziarats (Free of cost)</span>
              </label>
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

        <div className="space-y-4">
          <Card className="shadow-sm border-0 bg-navy text-white sticky top-0">
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
                      disabled={isDownloading || !pdfReady || !logoDataUrl || !invoiceNo}
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

      {pdfReady && logoDataUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none' }}>
          <CustomInvoiceTemplate
            ref={printRef}
            invoice={packageInvoice}
            branding={branding}
            titleText="CUSTOM INVOICE"
            titleFontSize={38}
            titleTop={22}
            invoiceIdY={92}
            dateY={109.5}
            centerInvoiceId
            backgroundImage={PACKAGE_INVOICE_BG}
          />
        </div>
      )}
    </>
  )
}
