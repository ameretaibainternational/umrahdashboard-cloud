'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getCalc } from '@/lib/calculations'
import type { Airline, Hotel, VisaSettings, CurrencySettings, TransportRate, RoomType, CalcInput, ZiaratOption } from '@/lib/types'
import { DEFAULT_TRANSPORT_VEHICLE, TRANSPORT_VEHICLES, type TransportVehicle } from '@/lib/transport'
import { ziaratBySlug } from '@/lib/ziarats'
import {
  BOOK_BEFORE_PREFIX,
  DEFAULT_POSTER_DATA,
  POSTER_H,
  POSTER_W,
  withLeadingSpace,
  type UmrahPosterFormData,
  downloadPosterCanvas,
  renderPosterToCanvas,
} from '@/lib/umrah-poster-canvas'
import {
  clampLogoPosition,
  DEFAULT_POSTER_LOGO_SIZE,
  DEFAULT_POSTER_LOGO_X,
  DEFAULT_POSTER_LOGO_Y,
  DEFAULT_POSTER_ADD_CORNER,
  POSTER_CANVAS_H,
  POSTER_CANVAS_W,
  POSTER_LOGO_MAX_BYTES,
  POSTER_LOGO_SIZE_MAX,
  POSTER_LOGO_SIZE_MIN,
  type PosterBranding,
} from '@/lib/umrah-poster-branding-layout'
import { BrandingSlider, BrandingResetButton } from '@/components/branding/BrandingSlider'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read logo file'))
    reader.readAsDataURL(file)
  })
}

function formatPosterPrice(n: number): string {
  return Math.round(n).toLocaleString('en-PK')
}

function Section({ title, children, collapsible, open, onToggle }: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader
        className={`pb-2 pt-4 px-4 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-navy">{title}</CardTitle>
          {collapsible && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
        </div>
      </CardHeader>
      {(!collapsible || open) && (
        <CardContent className="px-4 pb-4 space-y-3">{children}</CardContent>
      )}
    </Card>
  )
}

function ScaledCanvasPreview({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? POSTER_W
      setScale(Math.min(w / POSTER_W, 1))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-lg border bg-muted/20">
      <div
        style={{
          width: `${POSTER_W}px`,
          height: `${POSTER_H * scale}px`,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={POSTER_W}
          height={POSTER_H}
          className="block"
          style={{ width: `${POSTER_W}px`, height: `${POSTER_H}px` }}
        />
      </div>
    </div>
  )
}

interface Props {
  airlines: Airline[]
  makkahHotels: Hotel[]
  madinahHotels: Hotel[]
  visa: VisaSettings
  currency: CurrencySettings
  transportRates: TransportRate[]
  ziarats: ZiaratOption[]
}

function defaultPosterZiaratIds(ziarats: ZiaratOption[]): string[] {
  return ['makkah', 'madinah']
    .map(slug => ziaratBySlug(ziarats, slug as 'makkah' | 'madinah')?.id)
    .filter((id): id is string => Boolean(id))
}

export default function UmrahPosterForm({
  airlines,
  makkahHotels,
  madinahHotels,
  visa,
  currency,
  transportRates,
  ziarats,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<UmrahPosterFormData>(DEFAULT_POSTER_DATA)
  const [showCalc, setShowCalc] = useState(false)
  const [adult, setAdult] = useState(1)
  const [child, setChild] = useState(0)
  const [infant, setInfant] = useState(0)
  const [airlineId, setAirlineId] = useState(airlines[0]?.id ?? '')
  const [transportType, setTransportType] = useState<TransportVehicle>(DEFAULT_TRANSPORT_VEHICLE)
  const [makkahHotelId, setMakkahHotelId] = useState(makkahHotels[0]?.id ?? '')
  const [madinahHotelId, setMadinahHotelId] = useState(madinahHotels[0]?.id ?? '')
  const [makkahNights, setMakkahNights] = useState(10)
  const [madinahNights, setMadinahNights] = useState(7)
  const [selectedZiaratIds, setSelectedZiaratIds] = useState<string[]>(() => defaultPosterZiaratIds(ziarats))
  const [isRendering, setIsRendering] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [addCorner, setAddCorner] = useState(DEFAULT_POSTER_ADD_CORNER)
  const [logoSize, setLogoSize] = useState(DEFAULT_POSTER_LOGO_SIZE)
  const [logoX, setLogoX] = useState(DEFAULT_POSTER_LOGO_X)
  const [logoY, setLogoY] = useState(DEFAULT_POSTER_LOGO_Y)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const logoMaxX = Math.max(0, POSTER_CANVAS_W - logoSize)
  const logoMaxY = Math.max(0, POSTER_CANVAS_H - logoSize)

  const branding: PosterBranding = { logoUrl, addCorner, logoX, logoY, logoSize }

  function updateLogoSize(nextSize: number) {
    const size = Math.min(POSTER_LOGO_SIZE_MAX, Math.max(POSTER_LOGO_SIZE_MIN, nextSize))
    setLogoSize(size)
    const clamped = clampLogoPosition(logoX, logoY, size)
    setLogoX(clamped.x)
    setLogoY(clamped.y)
  }

  function updateLogoX(nextX: number) {
    setLogoX(clampLogoPosition(nextX, logoY, logoSize).x)
  }

  function updateLogoY(nextY: number) {
    setLogoY(clampLogoPosition(logoX, nextY, logoSize).y)
  }

  function resetLogoDefaults() {
    setLogoSize(DEFAULT_POSTER_LOGO_SIZE)
    setLogoX(DEFAULT_POSTER_LOGO_X)
    setLogoY(DEFAULT_POSTER_LOGO_Y)
  }

  const isDefaultLogo =
    logoSize === DEFAULT_POSTER_LOGO_SIZE &&
    logoX === DEFAULT_POSTER_LOGO_X &&
    logoY === DEFAULT_POSTER_LOGO_Y

  const setField = <K extends keyof UmrahPosterFormData>(key: K, value: UmrahPosterFormData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const setSpacedField = (key: 'ziyarat', value: string) => {
    setField(key, withLeadingSpace(value) as UmrahPosterFormData[typeof key])
  }

  const airline = airlines.find(a => a.id === airlineId) ?? null
  const makkahHotel = makkahHotels.find(h => h.id === makkahHotelId) ?? null
  const madinahHotel = madinahHotels.find(h => h.id === madinahHotelId) ?? null

  const calcPrices = useMemo(() => {
    const baseInput = {
      adult,
      child,
      infant,
      airline,
      transportType,
      makkahHotel,
      makkahNights,
      madinahHotel,
      madinahNights,
      profitType: 'percent' as const,
      profitValue: 8,
      sellingOverride: null,
      advance: 0,
      customerName: '',
      selectedZiaratIds,
      includeMakkahHotel: true,
      includeMadinahHotel: true,
      includeTickets: true,
      customTicket: false,
      customTicketLabel: '',
      customTicketPkr: 0,
    }

    const rooms: RoomType[] = ['sharing', 'quad', 'triple', 'double']
    const prices: Record<RoomType, number> = {
      room: 0,
      sharing: 0,
      quad: 0,
      triple: 0,
      double: 0,
    }

    for (const room of rooms) {
      const input: CalcInput = {
        ...baseInput,
        makkahRoom: room,
        madinahRoom: room,
      }
      prices[room] = getCalc(input, transportRates, currency.sar_to_pkr, visa, visa.transport_mode, ziarats).selling
    }

    return prices
  }, [
    adult, child, infant, airline, transportType, makkahHotel, madinahHotel,
    makkahNights, madinahNights, selectedZiaratIds,
    transportRates, currency.sar_to_pkr, visa, ziarats,
  ])

  useEffect(() => {
    if (!showCalc) return
    setData(prev => ({
      ...prev,
      price: formatPosterPrice(calcPrices.sharing),
      sharingPrice: formatPosterPrice(calcPrices.sharing),
      quadPrice: formatPosterPrice(calcPrices.quad),
      triplePrice: formatPosterPrice(calcPrices.triple),
      doublePrice: formatPosterPrice(calcPrices.double),
    }))
  }, [calcPrices, showCalc])

  function handleMakkahHotelSelect(id: string) {
    setMakkahHotelId(id)
    const hotel = makkahHotels.find(h => h.id === id)
    if (hotel) setField('makkahHotelName', hotel.name)
  }

  function handleMadinahHotelSelect(id: string) {
    setMadinahHotelId(id)
    const hotel = madinahHotels.find(h => h.id === id)
    if (hotel) setField('madinaHotelName', hotel.name)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > POSTER_LOGO_MAX_BYTES) {
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

  const redraw = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsRendering(true)
    try {
      await renderPosterToCanvas(canvas, data, branding)
    } catch (err) {
      console.error('[poster] render error:', err)
    } finally {
      setIsRendering(false)
    }
  }, [data, logoUrl, addCorner, logoX, logoY, logoSize])

  useEffect(() => {
    const t = setTimeout(() => { void redraw() }, 150)
    return () => clearTimeout(t)
  }, [redraw])

  async function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDownloading(true)
    try {
      await renderPosterToCanvas(canvas, data, branding)
      const slug = data.cityName.trim().replace(/\s+/g, '-').toLowerCase() || 'umrah-package'
      downloadPosterCanvas(canvas, `${slug}-poster.jpg`)
      toast.success('Poster downloaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* ── Form ── */}
      <div className="xl:w-[42%] shrink-0 space-y-4">
        <Section title="Package Details">
          <div className="space-y-1.5">
            <Label className="text-xs">Blessed Umrahs Line</Label>
            <Input
              value={data.blessedLine}
              onChange={e => setField('blessedLine', e.target.value)}
              placeholder="03 BLESSED UMRAHS WITH ZIYARATS"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City Name</Label>
            <Input
              value={data.cityName}
              onChange={e => setField('cityName', e.target.value)}
              placeholder="ISLAMABAD"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Days &amp; Departure Time</Label>
            <Input
              value={data.daysDeparture}
              onChange={e => setField('daysDeparture', e.target.value)}
              placeholder="15 Days | Departs 15 March 2026"
              className="h-9"
            />
          </div>
        </Section>

        <Section
          title="Price Calculator (not shown on poster)"
          collapsible
          open={showCalc}
          onToggle={() => setShowCalc(v => !v)}
        >
          <p className="text-[10px] text-muted-foreground">
            Uses the same calculator as the package tool. Calculated prices fill the pricing fields below.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Adults</Label>
              <Input type="number" min="0" value={adult} onChange={e => setAdult(Number(e.target.value) || 0)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Children</Label>
              <Input type="number" min="0" value={child} onChange={e => setChild(Number(e.target.value) || 0)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Infants</Label>
              <Input type="number" min="0" value={infant} onChange={e => setInfant(Number(e.target.value) || 0)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Airline</Label>
            <select
              value={airlineId}
              onChange={e => setAirlineId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {airlines.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Makkah Hotel</Label>
              <select
                value={makkahHotelId}
                onChange={e => handleMakkahHotelSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {makkahHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} · {h.distance}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Madinah Hotel</Label>
              <select
                value={madinahHotelId}
                onChange={e => handleMadinahHotelSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {madinahHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} · {h.distance}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Makkah Nights</Label>
              <Input type="number" min="1" value={makkahNights} onChange={e => setMakkahNights(Number(e.target.value) || 1)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Madinah Nights</Label>
              <Input type="number" min="1" value={madinahNights} onChange={e => setMadinahNights(Number(e.target.value) || 1)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transport</Label>
              <select
                value={transportType}
                onChange={e => setTransportType(e.target.value as TransportVehicle)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {TRANSPORT_VEHICLES.map(vehicle => (
                  <option key={vehicle} value={vehicle}>{vehicle}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            {ziarats.map(z => (
              <label key={z.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedZiaratIds.includes(z.id)}
                  onCheckedChange={v => {
                    const checked = Boolean(v)
                    setSelectedZiaratIds(prev =>
                      checked ? [...new Set([...prev, z.id])] : prev.filter(id => id !== z.id),
                    )
                  }}
                />
                <span className="text-xs">{z.name}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Hotels &amp; Ziyarat">
          <div className="space-y-1.5">
            <Label className="text-xs">Makkah Hotel Name</Label>
            {makkahHotels.length > 0 ? (
              <select
                value={makkahHotels.find(h => h.name === data.makkahHotelName)?.id ?? makkahHotelId}
                onChange={e => handleMakkahHotelSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {makkahHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} · {h.distance}</option>
                ))}
              </select>
            ) : (
              <Input
                value={data.makkahHotelName}
                onChange={e => setField('makkahHotelName', e.target.value)}
                placeholder="Hiba Hijra 6 or Similar"
                className="h-9"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Makkah Hotel Details</Label>
            <Input
              value={data.makkahHotelDetails}
              onChange={e => setField('makkahHotelDetails', e.target.value)}
              placeholder="( Nights 12 | 1500 Meter + Shuttle Service )"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Madina Hotel Name</Label>
            {madinahHotels.length > 0 ? (
              <select
                value={madinahHotels.find(h => h.name === data.madinaHotelName)?.id ?? madinahHotelId}
                onChange={e => handleMadinahHotelSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {madinahHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} · {h.distance}</option>
                ))}
              </select>
            ) : (
              <Input
                value={data.madinaHotelName}
                onChange={e => setField('madinaHotelName', e.target.value)}
                placeholder="Anwar Al Madinah Mövenpick"
                className="h-9"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Madina Hotel Details</Label>
            <Input
              value={data.madinaHotelDetails}
              onChange={e => setField('madinaHotelDetails', e.target.value)}
              placeholder="( Haram View )"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ziyarat Details (optional) <span className="text-muted-foreground">(wraps at 45 chars)</span></Label>
            <Input
              value={data.ziyarat}
              onChange={e => setSpacedField('ziyarat', e.target.value)}
              placeholder=" Makkah & Madinah Ziyarat Included"
              className="h-9"
            />
          </div>
        </Section>

        <Section title="Pricing">
          <div className="space-y-1.5">
            <Label className="text-xs">Main Price (on tag)</Label>
            <Input
              value={data.price}
              onChange={e => setField('price', e.target.value)}
              placeholder="185,000"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sharing</Label>
              <Input value={data.sharingPrice} onChange={e => setField('sharingPrice', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quad</Label>
              <Input value={data.quadPrice} onChange={e => setField('quadPrice', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Triple</Label>
              <Input value={data.triplePrice} onChange={e => setField('triplePrice', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Double</Label>
              <Input value={data.doublePrice} onChange={e => setField('doublePrice', e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Saving Price</Label>
            <Input
              value={data.savingPrice}
              onChange={e => setField('savingPrice', e.target.value)}
              placeholder="SAVE 15,000"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Book Before Date</Label>
            <p className="text-[10px] text-muted-foreground">
              &ldquo;{BOOK_BEFORE_PREFIX}&rdquo; is always shown on the poster; enter the date only.
            </p>
            <Input
              value={data.bookBeforeDate}
              onChange={e => setField('bookBeforeDate', e.target.value)}
              placeholder="10 March 2026"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Number</Label>
              <Input
                value={data.contactNumber}
                onChange={e => setField('contactNumber', e.target.value)}
                placeholder="+92 300 0000000"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input
                value={data.websiteUrl}
                onChange={e => setField('websiteUrl', e.target.value)}
                placeholder="www.ameretaiba.com"
                className="h-9"
              />
            </div>
          </div>
        </Section>

        <Section title="Branding">
          <p className="text-[10px] text-muted-foreground mb-2">
            Logo stays in your browser only until download — not stored on the server. Recommended size: 215×215 px.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Logo Upload (max 150 KB)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="h-9 text-xs"
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
                label="Logo Size"
                value={logoSize}
                min={POSTER_LOGO_SIZE_MIN}
                max={POSTER_LOGO_SIZE_MAX}
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
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <Checkbox
              checked={addCorner}
              onCheckedChange={v => setAddCorner(Boolean(v))}
            />
            <span className="text-sm">Add Corner</span>
          </label>
        </Section>
      </div>

      {/* ── Preview ── */}
      <div className="min-w-0 flex-1 xl:sticky xl:top-6 xl:self-start space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground font-medium">
            Live Preview {isRendering && <span className="text-muted-foreground/60">(updating…)</span>}
          </p>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isRendering}
            className="gap-2 bg-navy hover:bg-navy/90 text-white h-9 text-xs"
            size="sm"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Preparing…' : 'Download High-Quality Image'}
          </Button>
        </div>

        <ScaledCanvasPreview canvasRef={canvasRef} />

        <p className="text-[10px] text-muted-foreground text-center">
          Output: 1587 × 2245 px JPEG · Base: Umrah Package-empty.jpg
        </p>
      </div>
    </div>
  )
}
