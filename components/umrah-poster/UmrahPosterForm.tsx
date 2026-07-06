'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getCalc } from '@/lib/calculations'
import type { Airline, Hotel, VisaSettings, CurrencySettings, TransportRate, RoomType, CalcInput, ZiaratOption } from '@/lib/types'
import { DEFAULT_TRANSPORT_VEHICLE, listTransportOptions } from '@/lib/transport'
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
  POSTER_BACKGROUNDS,
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

interface ColorPickerProps {
  label?: string
  value?: string
  defaultValue: string
  onChange: (val: string) => void
}

function ColorPicker({ label = 'Color', value, defaultValue, onChange }: ColorPickerProps) {
  const color = value || defaultValue
  const hasChanged = value !== undefined && value !== null && value.toLowerCase() !== defaultValue.toLowerCase()
  return (
    <div className="space-y-1 shrink-0">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <div className="relative w-9 h-9 rounded-md border border-input overflow-hidden cursor-pointer flex items-center justify-center bg-muted/20">
          <input
            type="color"
            value={color}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="w-5 h-5 rounded-md shadow-sm border border-black/10"
            style={{ backgroundColor: color }}
          />
        </div>
        <Input
          type="text"
          value={color}
          onChange={e => {
            let val = e.target.value
            if (val && !val.startsWith('#')) {
              val = '#' + val
            }
            onChange(val)
          }}
          className="w-20 h-9 text-xs uppercase px-1.5 text-center font-mono"
          placeholder={defaultValue}
          maxLength={7}
        />
        {hasChanged && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(defaultValue)}
            className="w-8 h-9 shrink-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
            title="Reset to default color"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
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
  const [showHeadings, setShowHeadings] = useState(false)
  const [showAirplaneSettings, setShowAirplaneSettings] = useState(false)
  const [customVisaPkr, setCustomVisaPkr] = useState(0)
  const [useCustomTicket, setUseCustomTicket] = useState(false)
  const [customTicketPkr, setCustomTicketPkr] = useState(0)
  const [includeTransport, setIncludeTransport] = useState(true)
  const [airlineId, setAirlineId] = useState(airlines[0]?.id ?? '')
  const [transportType, setTransportType] = useState<string>(DEFAULT_TRANSPORT_VEHICLE)
  const transportOptions = useMemo(() => listTransportOptions(transportRates), [transportRates])
  const [makkahHotelId, setMakkahHotelId] = useState(makkahHotels[0]?.id ?? '')
  const [madinahHotelId, setMadinahHotelId] = useState(madinahHotels[0]?.id ?? '')
  const [makkahNights, setMakkahNights] = useState(10)
  const [madinahNights, setMadinahNights] = useState(7)
  const [selectedZiaratIds, setSelectedZiaratIds] = useState<string[]>(() => defaultPosterZiaratIds(ziarats))
  const [isRendering, setIsRendering] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [addCorner, setAddCorner] = useState(DEFAULT_POSTER_ADD_CORNER)
  const [cornerColor, setCornerColor] = useState('#1b376e')
  const [logoSize, setLogoSize] = useState(DEFAULT_POSTER_LOGO_SIZE)
  const [logoX, setLogoX] = useState(DEFAULT_POSTER_LOGO_X)
  const [logoY, setLogoY] = useState(DEFAULT_POSTER_LOGO_Y)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const logoMaxX = Math.max(0, POSTER_CANVAS_W - logoSize)
  const logoMaxY = Math.max(0, POSTER_CANVAS_H - logoSize)

  const branding: PosterBranding = { logoUrl, addCorner, logoX, logoY, logoSize, cornerColor }

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
      adult: 1,
      child: 0,
      infant: 0,
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
      customTicket: useCustomTicket,
      customTicketLabel: '',
      customTicketPkr: customTicketPkr,
      includeTransport,
      customVisaPkr,
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
    customVisaPkr, useCustomTicket, customTicketPkr, includeTransport,
    airline, transportType, makkahHotel, madinahHotel,
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
    if (hotel) {
      setField('makkahHotelName', hotel.name)
      setField('makkahHotelDetails', `( ${makkahNights} Nights - ${hotel.distance} )`)
    }
  }

  function handleMadinahHotelSelect(id: string) {
    setMadinahHotelId(id)
    const hotel = madinahHotels.find(h => h.id === id)
    if (hotel) {
      setField('madinaHotelName', hotel.name)
      setField('madinaHotelDetails', `( ${madinahNights} Nights - ${hotel.distance} )`)
    }
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
  }, [data, logoUrl, addCorner, logoX, logoY, logoSize, cornerColor])

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
        <Section title="Poster Background">
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground mb-1">
              Select a template background style for the poster.
            </p>
            <div className="flex flex-wrap gap-2">
              {POSTER_BACKGROUNDS.map(bg => {
                const isSelected = (data.backgroundImage || 'Dark Blue') === bg.name
                return (
                  <button
                    key={bg.name}
                    type="button"
                    onClick={() => setField('backgroundImage', bg.name)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-1.5 transition-all min-w-[4.75rem] ${
                      isSelected
                        ? 'border-navy bg-navy/5 shadow-sm ring-2 ring-navy/20'
                        : 'border-border/60 hover:border-navy/40 hover:bg-muted/30'
                    }`}
                    title={bg.name}
                  >
                    <span
                      className="block h-12 w-12 shrink-0 rounded-full border border-black/10 shadow-inner"
                      style={{ background: bg.swatch }}
                    />
                    <span className="text-[9px] font-semibold text-center leading-tight text-muted-foreground max-w-[4.5rem]">
                      {bg.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Package Details">
          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Blessed Umrahs Line</Label>
              <Input
                value={data.blessedLine}
                onChange={e => setField('blessedLine', e.target.value)}
                placeholder="03 BLESSED UMRAHS WITH ZIYARATS"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.blessedLineColor}
              defaultValue="#12375d"
              onChange={val => setField('blessedLineColor', val)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">City Name</Label>
              <Input
                value={data.cityName}
                onChange={e => setField('cityName', e.target.value)}
                placeholder="ISLAMABAD"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.cityNameColor}
              defaultValue="#bd872b"
              onChange={val => setField('cityNameColor', val)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Days &amp; Departure Time</Label>
              <Input
                value={data.daysDeparture}
                onChange={e => setField('daysDeparture', e.target.value)}
                placeholder="15 Days | Departs 15 March 2026"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.daysDepartureColor}
              defaultValue="#12375d"
              onChange={val => setField('daysDepartureColor', val)}
            />
          </div>
        </Section>

        <Section
          title="Poster Headings &amp; Colors"
          collapsible
          open={showHeadings}
          onToggle={() => setShowHeadings(v => !v)}
        >
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Umrah Package Title</Label>
                <Input
                  value={data.umrahPackageText}
                  onChange={e => setField('umrahPackageText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.umrahPackageColor}
                defaultValue="#12375d"
                onChange={val => setField('umrahPackageColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">What's Included Title</Label>
                <Input
                  value={data.whatsIncludedText}
                  onChange={e => setField('whatsIncludedText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.whatsIncludedColor}
                defaultValue="#ffffff"
                onChange={val => setField('whatsIncludedColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Package Prices Title</Label>
                <Input
                  value={data.packagePricesText}
                  onChange={e => setField('packagePricesText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.packagePricesColor}
                defaultValue="#ffffff"
                onChange={val => setField('packagePricesColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">More Information Title</Label>
                <Input
                  value={data.moreInfoText}
                  onChange={e => setField('moreInfoText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.moreInfoColor}
                defaultValue="#ffffff"
                onChange={val => setField('moreInfoColor', val)}
              />
            </div>

            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Special Promo Text</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const current = data.specialPromoText
                      if (current.toUpperCase().startsWith('SPECIAL ') && !current.includes('\n')) {
                        setField('specialPromoText', current.replace(/SPECIAL /i, 'SPECIAL\n'))
                      } else {
                        setField('specialPromoText', current.replace('\n', ' '))
                      }
                    }}
                    className="text-[10px] text-navy hover:underline font-medium"
                  >
                    Toggle Line Break
                  </button>
                </div>
                <textarea
                  value={data.specialPromoText}
                  onChange={e => setField('specialPromoText', e.target.value)}
                  placeholder="SPECIAL&#10;PROMO"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <ColorPicker
                value={data.specialPromoColor}
                defaultValue="#ffffff"
                onChange={val => setField('specialPromoColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Save Up To Label</Label>
                <Input
                  value={data.saveUpToText}
                  onChange={e => setField('saveUpToText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.saveUpToColor}
                defaultValue="#12375d"
                onChange={val => setField('saveUpToColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Book Before Label</Label>
                <Input
                  value={data.bookBeforeLabelText}
                  onChange={e => setField('bookBeforeLabelText', e.target.value)}
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.bookBeforeLabelColor}
                defaultValue="#12375d"
                onChange={val => setField('bookBeforeLabelColor', val)}
              />
            </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Visa Rate (PKR)</Label>
              <Input
                type="number"
                min="0"
                value={customVisaPkr || ''}
                onChange={e => setCustomVisaPkr(Number(e.target.value) || 0)}
                placeholder="From settings if empty"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={useCustomTicket}
                  onCheckedChange={v => setUseCustomTicket(Boolean(v))}
                />
                <span className="text-xs font-medium">Custom Ticket Rate</span>
              </label>
            </div>
          </div>

          {useCustomTicket && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ticket Rate (PKR)</Label>
              <Input
                type="number"
                min="0"
                value={customTicketPkr || ''}
                onChange={e => setCustomTicketPkr(Number(e.target.value) || 0)}
                placeholder="Enter custom ticket rate"
                className="h-9"
              />
            </div>
          )}

          {!useCustomTicket && (
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
          )}

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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Transport</Label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <Checkbox
                    checked={includeTransport}
                    onCheckedChange={v => setIncludeTransport(Boolean(v))}
                  />
                  <span className="text-[10px] text-muted-foreground">Include</span>
                </label>
              </div>
              <select
                value={transportType}
                onChange={e => setTransportType(e.target.value)}
                disabled={!includeTransport}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
              >
                {transportOptions.map(vehicle => (
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
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Makkah Hotel Label</Label>
                <Input
                  value={data.makkahHotelLabel !== undefined ? data.makkahHotelLabel : 'Makkah Hotel:'}
                  onChange={e => setField('makkahHotelLabel', e.target.value)}
                  placeholder="Makkah Hotel:"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Makkah Hotel Name</Label>
                  {makkahHotels.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        checked={!!data.makkahCustomName}
                        onCheckedChange={v => setField('makkahCustomName', Boolean(v))}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">Custom Name</span>
                    </label>
                  )}
                </div>
                {makkahHotels.length > 0 && !data.makkahCustomName ? (
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
            </div>
            <ColorPicker
              value={data.makkahHotelColor}
              defaultValue="#12375d"
              onChange={val => setField('makkahHotelColor', val)}
            />
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Madina Hotel Label</Label>
                <Input
                  value={data.madinaHotelLabel !== undefined ? data.madinaHotelLabel : 'Madina Hotel:'}
                  onChange={e => setField('madinaHotelLabel', e.target.value)}
                  placeholder="Madina Hotel:"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Madina Hotel Name</Label>
                  {madinahHotels.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        checked={!!data.madinaCustomName}
                        onCheckedChange={v => setField('madinaCustomName', Boolean(v))}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">Custom Name</span>
                    </label>
                  )}
                </div>
                {madinahHotels.length > 0 && !data.madinaCustomName ? (
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
            </div>
            <ColorPicker
              value={data.madinaHotelColor}
              defaultValue="#12375d"
              onChange={val => setField('madinaHotelColor', val)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Ziyarat Details (optional) <span className="text-muted-foreground">(wraps at 45 chars)</span></Label>
              <Input
                value={data.ziyarat}
                onChange={e => setSpacedField('ziyarat', e.target.value)}
                placeholder=" Makkah & Madinah Ziyarat Included"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.ziyaratColor}
              defaultValue="#12375d"
              onChange={val => setField('ziyaratColor', val)}
            />
          </div>
        </Section>

        <Section title="Pricing">
          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Main Price (on tag)</Label>
              <Input
                value={data.price}
                onChange={e => setField('price', e.target.value)}
                placeholder="185,000"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.priceColor}
              defaultValue="#ffffff"
              onChange={val => setField('priceColor', val)}
            />
          </div>

          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-3">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Sharing Label</Label>
                    <Input
                      value={data.sharingLabel !== undefined ? data.sharingLabel : 'Sharing: '}
                      onChange={e => setField('sharingLabel', e.target.value)}
                      placeholder="Sharing: "
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Sharing Price</Label>
                    <Input
                      value={data.sharingPrice}
                      onChange={e => setField('sharingPrice', e.target.value)}
                      placeholder="Price"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Quad Label</Label>
                    <Input
                      value={data.quadLabel !== undefined ? data.quadLabel : 'Quad: '}
                      onChange={e => setField('quadLabel', e.target.value)}
                      placeholder="Quad: "
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Quad Price</Label>
                    <Input
                      value={data.quadPrice}
                      onChange={e => setField('quadPrice', e.target.value)}
                      placeholder="Price"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Triple Label</Label>
                    <Input
                      value={data.tripleLabel !== undefined ? data.tripleLabel : 'Triple: '}
                      onChange={e => setField('tripleLabel', e.target.value)}
                      placeholder="Triple: "
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Triple Price</Label>
                    <Input
                      value={data.triplePrice}
                      onChange={e => setField('triplePrice', e.target.value)}
                      placeholder="Price"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Double Label</Label>
                    <Input
                      value={data.doubleLabel !== undefined ? data.doubleLabel : 'Double: '}
                      onChange={e => setField('doubleLabel', e.target.value)}
                      placeholder="Double: "
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Double Price</Label>
                    <Input
                      value={data.doublePrice}
                      onChange={e => setField('doublePrice', e.target.value)}
                      placeholder="Price"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            <ColorPicker
              value={data.packagePricesListColor}
              defaultValue="#12375d"
              onChange={val => setField('packagePricesListColor', val)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Saving Price</Label>
              <Input
                value={data.savingPrice}
                onChange={e => setField('savingPrice', e.target.value)}
                placeholder="SAVE 15,000"
                className="h-9"
              />
            </div>
            <ColorPicker
              value={data.savingPriceColor}
              defaultValue="#bd872b"
              onChange={val => setField('savingPriceColor', val)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 space-y-1">
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
            <ColorPicker
              value={data.bookBeforeDateColor}
              defaultValue="#12375d"
              onChange={val => setField('bookBeforeDateColor', val)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Contact Number</Label>
                <Input
                  value={data.contactNumber}
                  onChange={e => setField('contactNumber', e.target.value)}
                  placeholder="+92 300 0000000"
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.contactNumberColor}
                defaultValue="#12375d"
                onChange={val => setField('contactNumberColor', val)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Website URL</Label>
                <Input
                  value={data.websiteUrl}
                  onChange={e => setField('websiteUrl', e.target.value)}
                  placeholder="www.ameretaiba.com"
                  className="h-9"
                />
              </div>
              <ColorPicker
                value={data.websiteUrlColor}
                defaultValue="#12375d"
                onChange={val => setField('websiteUrlColor', val)}
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
          <div className="flex items-center justify-between gap-2.5 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={addCorner}
                onCheckedChange={v => setAddCorner(Boolean(v))}
              />
              <span className="text-sm">Add Corner</span>
            </label>
            {addCorner && (
              <ColorPicker
                label="Corner Color"
                value={cornerColor}
                defaultValue="#1b376e"
                onChange={setCornerColor}
              />
            )}
          </div>
        </Section>

        <Section
          title="Airplane Graphics &amp; Position"
          collapsible
          open={showAirplaneSettings}
          onToggle={() => setShowAirplaneSettings(v => !v)}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={data.showAirplane}
                onCheckedChange={v => setField('showAirplane', Boolean(v))}
              />
              <span className="text-sm font-medium">Show Airplane Image</span>
            </label>

            {data.showAirplane && (
              <div className="space-y-3 pt-2 border-t border-dashed">
                <BrandingSlider
                  label="Airplane X Position"
                  value={data.airplaneX}
                  min={0}
                  max={42}
                  step={0.05}
                  unit="cm"
                  onChange={v => setField('airplaneX', v)}
                />
                <BrandingSlider
                  label="Airplane Y Position"
                  value={data.airplaneY}
                  min={-10}
                  max={60}
                  step={0.05}
                  unit="cm"
                  onChange={v => setField('airplaneY', v)}
                />
                <BrandingSlider
                  label="Airplane Width"
                  value={data.airplaneWidth}
                  min={1}
                  max={42}
                  step={0.05}
                  unit="cm"
                  onChange={v => setField('airplaneWidth', v)}
                />
                <BrandingSlider
                  label="Airplane Height"
                  value={data.airplaneHeight}
                  min={1}
                  max={30}
                  step={0.05}
                  unit="cm"
                  onChange={v => setField('airplaneHeight', v)}
                />
              </div>
            )}
          </div>
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
