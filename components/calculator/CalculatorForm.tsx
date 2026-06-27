'use client'

import { useState, useMemo, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getCalc, generateInvoiceNumber } from '@/lib/calculations'
import { pkr as fmtPkr } from '@/lib/formatters'
import { createBooking } from '@/app/actions/bookings'
import { createPackageInvoiceWithPdf, updatePackageInvoiceWithPdf } from '@/app/actions/package-invoices'
import { downloadPdfBytes } from '@/lib/storage-client'
import { uint8ToBase64 } from '@/lib/pdf-utils'
import { getPackageDataFromInvoice, isPackageInvoice } from '@/lib/package-invoice'
import type { Airline, Hotel, VisaSettings, CurrencySettings, TransportRate, RoomType, CalcInput, CustomInvoice, PackageInvoiceData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BookmarkPlus, Copy, Download, Loader2, CheckCircle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import InvoicePrint from './InvoicePrint'
import type { Company } from '@/lib/types'

interface Props {
  airlines: Airline[]
  makkahHotels: Hotel[]
  madinahHotels: Hotel[]
  visa: VisaSettings
  currency: CurrencySettings
  transportRates: TransportRate[]
  company: Company
  canSaveBooking?: boolean
  editInvoice?: CustomInvoice | null
}

function initialFromEdit(editInvoice?: CustomInvoice | null): PackageInvoiceData | null {
  if (!editInvoice) return null
  return getPackageDataFromInvoice(editInvoice)
}

export default function CalculatorForm({
  airlines, makkahHotels, madinahHotels, visa, currency, transportRates, company,
  canSaveBooking = true,
  editInvoice = null,
}: Props) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const initial = initialFromEdit(editInvoice)
  const [invoiceNo, setInvoiceNo] = useState(() => editInvoice?.invoice_number ?? '')
  const [pdfReady, setPdfReady] = useState(false)
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
  const [profitType, setProfitType] = useState<'percent' | 'fixed'>(initial?.profitType ?? 'percent')
  const [profitValue, setProfitValue] = useState(initial?.profitValue ?? 8)
  const [sellingOverride, setSellingOverride] = useState<number | null>(initial?.sellingOverride ?? null)
  const [advance, setAdvance] = useState(initial?.advance ?? 0)
  const [customerName, setCustomerName] = useState(initial?.customerName ?? editInvoice?.billed_to_name ?? '')
  const [makkahZiarat, setMakkahZiarat] = useState(initial?.makkahZiarat ?? false)
  const [madinahZiarat, setMadinahZiarat] = useState(initial?.madinahZiarat ?? false)
  const [customTicket, setCustomTicket] = useState(initial?.customTicket ?? false)
  const [customTicketLabel, setCustomTicketLabel] = useState(initial?.customTicketLabel ?? '')
  const [customTicketAmount, setCustomTicketAmount] = useState(initial?.customTicketAmount ?? 0)
  const [customTicketCurrency, setCustomTicketCurrency] = useState<'SAR' | 'PKR'>(initial?.customTicketCurrency ?? 'SAR')
  const [travelDate, setTravelDate] = useState(initial?.travelDate ?? editInvoice?.invoice_date ?? '')
  const [departureCity, setDepartureCity] = useState(initial?.departureCity ?? '')
  const [arrivalCity, setArrivalCity] = useState(initial?.arrivalCity ?? '')
  const [returnCity, setReturnCity] = useState(initial?.returnCity ?? '')

  useEffect(() => {
    setInvoiceNo(prev => prev || generateInvoiceNumber())
    setPdfReady(true)
  }, [])

  useEffect(() => {
    if (airlines.length > 0 && !airlines.some(a => a.id === airlineId)) {
      setAirlineId(airlines[0].id)
    }
  }, [airlines, airlineId])

  const PK_CITIES = ['Islamabad', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Sialkot', 'Faisalabad', 'Quetta']
  const SA_CITIES = ['Jeddah', 'Madinah', 'Riyadh', 'Dammam']

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

  const input: CalcInput = {
    adult, child, infant, airline, transportType,
    makkahHotel, makkahRoom, makkahNights,
    madinahHotel, madinahRoom, madinahNights,
    profitType, profitValue, sellingOverride, advance,
    customerName,
    makkahZiarat,
    madinahZiarat,
    customTicket,
    customTicketLabel,
    customTicketPkr,
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
     makkahZiarat, madinahZiarat,
     customTicket, customTicketPkr,
     transportRates]
  )

  async function generatePdfBytes(): Promise<Uint8Array> {
    const el = printRef.current
    if (!el) throw new Error('Invoice preview not ready.')
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      onclone: (clonedDoc: Document) => {
        clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(e => e.remove())
        const root = clonedDoc.body.querySelector('[data-calculator-invoice]') as HTMLElement | null
        if (root) {
          root.style.width = '794px'
          root.style.boxSizing = 'border-box'
        }
        const origin = window.location.origin
        clonedDoc.querySelectorAll<HTMLImageElement>('img').forEach(img => {
          const src = img.getAttribute('src')
          if (src?.startsWith('/')) img.src = `${origin}${src}`
        })
      },
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW = 210
    const pageH = 297
    let renderW = pageW
    let renderH = (canvas.height * pageW) / canvas.width
    if (renderH > pageH) {
      renderH = pageH
      renderW = (canvas.width * pageH) / canvas.height
    }
    const offsetX = (pageW - renderW) / 2
    pdf.addImage(imgData, 'JPEG', offsetX, 0, renderW, renderH)
    return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer)
  }

  function buildPackageData(): PackageInvoiceData {
    return {
      adult, child, infant, airlineId, transportType,
      makkahHotelId, makkahRoom, makkahNights,
      madinahHotelId, madinahRoom, madinahNights,
      profitType, profitValue, sellingOverride, advance,
      customerName,
      makkahZiarat, madinahZiarat,
      customTicket, customTicketLabel, customTicketAmount, customTicketCurrency,
      travelDate, departureCity, arrivalCity, returnCity,
    }
  }

  async function handleDownload() {
    setIsDownloading(true)
    try {
      const bytes = await generatePdfBytes()
      const pdfBase64 = uint8ToBase64(bytes)
      const billedName = customerName || 'Walk-in Customer'
      const invoiceDate = travelDate || new Date().toISOString().slice(0, 10)
      const payload = {
        invoice_number: invoiceNo,
        invoice_date: invoiceDate,
        billed_to_name: billedName,
        total: calc.selling,
        received: advance,
        remaining: calc.remaining,
        package_data: buildPackageData(),
        pdf_base64: pdfBase64,
        contact_phone: company.phone,
        contact_email: company.website,
        contact_location: company.address,
      }

      const isUpdate = Boolean(savedInvoiceId)
      const result = isUpdate
        ? await updatePackageInvoiceWithPdf({ id: savedInvoiceId!, ...payload })
        : await createPackageInvoiceWithPdf(payload)

      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }

      if (!isUpdate && 'id' in result && result.id) setSavedInvoiceId(result.id)
      const filename = billedName !== 'Walk-in Customer'
        ? `${invoiceNo}_${billedName.trim().replace(/\s+/g, '_')}.pdf`
        : `${invoiceNo}.pdf`
      downloadPdfBytes(bytes, filename)
      toast.success(isUpdate ? 'Invoice updated and downloaded.' : 'Invoice saved and downloaded.')
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
      const result = await createBooking({
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
        makkah_hotel_name: makkahHotel?.name ?? null,
        makkah_hotel_location: makkahHotel?.location ?? null,
        makkah_hotel_distance: makkahHotel?.distance ?? null,
        makkah_room_type: makkahRoom,
        makkah_nights: makkahNights,
        madinah_hotel_name: madinahHotel?.name ?? null,
        madinah_hotel_location: madinahHotel?.location ?? null,
        madinah_hotel_distance: madinahHotel?.distance ?? null,
        madinah_room_type: madinahRoom,
        madinah_nights: madinahNights,
      })

      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking saved successfully!')
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  function handleCopyWhatsApp() {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    const totalNights = makkahNights + madinahNights
    const airlineName = customTicket ? (customTicketLabel || 'Custom Ticket') : (airline?.name ?? '')
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

    const lines: string[] = [
      `🏷️ *${company.name}*`,
      `🕋 *${totalNights} Nights Umrah Package*`,
      ``,
      ...(formattedDate ? [`📅 Travel Date: ${formattedDate}`] : []),
      ...((departureCity || arrivalCity || returnCity)
        ? [`✈️ Route: ${departureCity || '—'} ➜ ${arrivalCity || '—'} ➜ ${returnCity || '—'}`]
        : []),
      ...(airlineName ? [`🛫 Airline: ${airlineName}`] : []),
      ``,
      `👤 Passengers: ${paxParts}`,
      ``,
      `🏨 *Makkah Hotel*`,
      makkahHotel?.name ?? 'N/A',
      `🛏️ ${cap(makkahRoom)} Room | 🌙 ${makkahNights} Nights`,
      ...(makkahZiarat ? [`🚌 Makkah Ziarats: Included`] : []),
      ``,
      `🏨 *Madinah Hotel*`,
      madinahHotel?.name ?? 'N/A',
      `🛏️ ${cap(madinahRoom)} Room | 🌙 ${madinahNights} Nights`,
      ...(madinahZiarat ? [`🚌 Madinah Ziarats: Included`] : []),
      ``,
      `💰 *Package Price: ${fmtPkr(calc.selling)}*`,
      `💰 Per Person: ${fmtPkr(calc.perPax)}`,
      ``,
      ...(contact ? [contact] : []),
    ]

    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('WhatsApp message copied!')
  }

  const rows = [
    { label: 'Tickets',                                                           value: fmtPkr(calc.ticketCost) },
    { label: 'Visa',                                                              value: fmtPkr(calc.visaCost) },
    { label: visa.transport_mode === 'included' ? 'Transport (Included)' : 'Transport', value: visa.transport_mode === 'included' ? '—' : fmtPkr(calc.transportCost) },
    { label: `Makkah Hotel (${makkahNights}N)`,                                   value: fmtPkr(calc.makkahCost) },
    { label: `Madinah Hotel (${madinahNights}N)`,                                 value: fmtPkr(calc.madinahCost) },
    ...(makkahZiarat  ? [{ label: 'Makkah Ziarats',  value: fmtPkr(calc.makkahZiaratCost)  }] : []),
    ...(madinahZiarat ? [{ label: 'Madina Ziarats',  value: fmtPkr(calc.madinahZiaratCost) }] : []),
  ]

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Left — form */}
        <div className="space-y-5">
          {/* Passengers */}
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

          {/* Airline + Transport */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Flight & Transport
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {/* Custom ticket toggle */}
              <label className="col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={customTicket}
                  onCheckedChange={v => setCustomTicket(Boolean(v))}
                />
                <span className="text-sm">Custom Ticket</span>
              </label>

              {customTicket ? (
                <>
                  {/* Airline / route label — full width */}
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Airline / Route</Label>
                    <Input
                      placeholder="e.g. PIA — LHR to JED"
                      value={customTicketLabel}
                      onChange={e => setCustomTicketLabel(e.target.value)}
                    />
                  </div>
                  {/* Price with SAR / PKR toggle */}
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

              {/* Route: Departure → Arrival → Return */}
              <div className="space-y-1.5">
                <Label className="text-xs">Departure (Pakistan)</Label>
                <Select value={departureCity} onValueChange={v => v && setDepartureCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {PK_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Arrival (Saudi Arabia)</Label>
                <Select value={arrivalCity} onValueChange={v => v && setArrivalCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {SA_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Return Arrival (Pakistan)</Label>
                <Select value={returnCity} onValueChange={v => v && setReturnCity(v)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {PK_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

          {/* Hotels */}
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

            return (
              <Card key={city} className="shadow-sm border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {city} Hotel
                  </CardTitle>
                </CardHeader>
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
                        {['sharing', 'quad', 'triple', 'double'].map(r => (
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
              </Card>
            )
          })}

          {/* Ziarats */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ziarats
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={makkahZiarat}
                  onCheckedChange={v => setMakkahZiarat(Boolean(v))}
                />
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
                <Checkbox
                  checked={madinahZiarat}
                  onCheckedChange={v => setMadinahZiarat(Boolean(v))}
                />
                <span className="text-sm">
                  Include Madinah Ziarats
                  {visa.madina_ziarat_rate > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtPkr(visa.madina_ziarat_rate * currency.sar_to_pkr)})
                    </span>
                  )}
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Profit */}
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

          {/* Customer */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Customer Name</Label>
                <Input
                  placeholder="Walk-in Customer"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
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

        {/* Right — summary */}
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {pdfReady && (
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none', width: '210mm' }}>
          <InvoicePrint
            ref={printRef}
            invoiceNo={invoiceNo}
            customerName={customerName || 'Walk-in Customer'}
            adult={adult} child={child} infant={infant}
            airline={airline}
            makkahHotel={makkahHotel} makkahRoom={makkahRoom} makkahNights={makkahNights}
            madinahHotel={madinahHotel} madinahRoom={madinahRoom} madinahNights={madinahNights}
            calc={calc}
            advance={advance}
            transportMode={visa.transport_mode}
            company={company}
            customTicket={customTicket}
            customTicketLabel={customTicketLabel}
            customTicketPkr={customTicketPkr}
            makkahZiarat={makkahZiarat}
            madinahZiarat={madinahZiarat}
            travelDate={travelDate}
            departureCity={departureCity}
            arrivalCity={arrivalCity}
            returnCity={returnCity}
          />
        </div>
      )}
    </>
  )
}
