'use client'

import { useState, useRef, useEffect, useCallback, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VoucherPage1, VoucherPage2 } from './HotelVoucherTemplate'
import type { VoucherData, Pilgrim, Accommodation } from './HotelVoucherTemplate'
import { JAMEEL_WOFF } from './HotelVoucherTemplate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, Download, Eye, FileText, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { updateHotelVoucherGuidelines } from '@/app/actions/hotel-voucher'
import { createHotelVoucherWithPdf, updateHotelVoucherWithPdf, deleteHotelVoucher, deleteHotelVouchers } from '@/app/actions/hotel-vouchers'
import { upsertHotel } from '@/app/actions/settings'
import { downloadPdfBytes, downloadStoredPdf } from '@/lib/storage-client'
import { uint8ToBase64 } from '@/lib/pdf-utils'
import { applyVoucherPdfCloneStyles } from '@/lib/invoice-pdf-onclone'
import type { Hotel, HotelVoucherSettings, HotelVoucherRecord, HotelContact, TransportContact } from '@/lib/types'
import {
  filterHotelContactsByCity,
  findHotelContactByNumber,
  hotelContactLabel,
} from '@/lib/hotel-contacts'
import { COLORFUL_INVOICE_BACKGROUNDS } from '@/lib/invoice-backgrounds'
import InvoiceAppearanceControls from '@/components/custom-invoice/InvoiceAppearanceControls'
import { BrandingSlider, BrandingResetButton } from '@/components/branding/BrandingSlider'
import {
  clampVoucherLogoPosition,
  DEFAULT_VOUCHER_LOGO_SIZE,
  DEFAULT_VOUCHER_LOGO_X,
  DEFAULT_VOUCHER_LOGO_Y,
  getVoucherLogoBoxSize,
  resolveVoucherLogoRect,
  scaleVoucherRect,
  VOUCHER_INTRINSIC_BG_H,
  VOUCHER_INTRINSIC_BG_W,
  VOUCHER_LOGO_MAX_BYTES,
  VOUCHER_TEMPLATE_H,
  VOUCHER_TEMPLATE_W,
  VOUCHER_LOGO_SIZE_MAX,
  VOUCHER_LOGO_SIZE_MIN,
  type VoucherBranding,
} from '@/lib/hotel-voucher-branding-layout'

const JAMEEL_WOFF_URL = JAMEEL_WOFF

const VOUCHER_BACKGROUNDS = [
  { id: 'classic', name: 'Classic', src: '/Empty-Hotel-Voucher.jpg', swatch: 'linear-gradient(145deg, #121117 0%, #2a2a35 100%)' },
  ...COLORFUL_INVOICE_BACKGROUNDS,
]

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read logo file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, x, y, dw, dh)
}

function hideBrandingLogoInClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll<HTMLElement>('[data-voucher-branding-logo]').forEach(el => {
    el.style.display = 'none'
  })
}

function drawVoucherLogoOnCanvas(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  branding: VoucherBranding,
  scale: number,
) {
  const { x, y, w, h } = resolveVoucherLogoRect(branding)
  const rect = scaleVoucherRect(x, y, w, h)
  drawImageContain(
    ctx,
    logoImg,
    rect.left * scale,
    rect.top * scale,
    rect.width * scale,
    rect.height * scale,
  )
}

async function ensureUrduFont() {
  try {
    if (!document.fonts.check('18px "Jameel Noori Nastaleeq"')) {
      const face = new FontFace(
        'Jameel Noori Nastaleeq',
        `url(${JAMEEL_WOFF_URL}) format('woff')`,
      )
      document.fonts.add(await face.load())
    }
    await document.fonts.load('18px "Jameel Noori Nastaleeq"')
    await document.fonts.ready
  } catch {
    // CSS @font-face / local() fallback
  }
}

function injectUrduPdfStyles(clonedDoc: Document) {
  const style = clonedDoc.createElement('style')
  style.textContent = `
    @font-face {
      font-family: 'Jameel Noori Nastaleeq';
      src: url('${JAMEEL_WOFF_URL}') format('woff');
      font-weight: normal;
      font-style: normal;
    }
    [data-urdu-text] {
      font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
      font-weight: normal !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      font-variant-ligatures: normal !important;
      -webkit-font-variant-ligatures: normal !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }
  `
  clonedDoc.head.appendChild(style)
}

async function captureUrduPage(
  el: HTMLElement,
  html2canvas: typeof import('html2canvas')['default'],
  scale: number,
) {
  const baseOpts = {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null as string | null,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc: Document) => {
      // Copy preloaded fonts to cloned document to fix web fonts in iframe
      document.fonts.forEach(font => {
        try {
          clonedDoc.fonts.add(font)
        } catch (e) {
          console.error('Failed to copy font to cloned doc:', e)
        }
      })
      // Keep Urdu font rules; only strip app stylesheets that break html2canvas (lab colors)
      clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => node.remove())
      injectUrduPdfStyles(clonedDoc)
      clonedDoc.querySelectorAll<HTMLElement>('[data-bg]').forEach(node => {
        node.style.display = 'none'
      })
      clonedDoc.querySelectorAll<HTMLElement>('[data-voucher-p2]').forEach(node => {
        node.style.backgroundColor = 'transparent'
      })
      hideBrandingLogoInClone(clonedDoc)
    },
  }

  // foreignObject uses the browser's native text shaper — fixes Nastaliq ligatures in PDF
  try {
    return await html2canvas(el, { ...baseOpts, foreignObjectRendering: true })
  } catch {
    return await html2canvas(el, baseOpts)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

function emptyPilgrim(): Pilgrim {
  return { id: uid(), name: '', passportNo: '', pax: '1', beds: '1', visaNumber: '', gender: 'M' }
}

function emptyAccommodation(): Accommodation {
  return { id: uid(), hotelName: '', confirmNo: '', city: 'Makkah', roomType: 'Room', mealPlan: 'BB', checkIn: '', checkOut: '', nights: '' }
}

const VOUCHER_ROOM_TYPES = ['Room', 'Sharing', 'Quad', 'Triple', 'Double', 'Quint (5 Bed)', 'Hexa (6 bed)'] as const

function calcCheckOut(checkIn: string, nights: string): string {
  if (!checkIn || !nights) return ''
  const n = parseInt(nights, 10)
  if (!n || n < 1) return ''
  const [y, m, d] = checkIn.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function hotelLabel(h: Hotel) {
  return `${h.name} | ${h.distance}`
}

function hotelsForCity(city: string, makkahHotels: Hotel[], madinahHotels: Hotel[]): Hotel[] {
  if (city === 'Makkah') return makkahHotels
  if (city === 'Madina') return madinahHotels
  return []
}

function resolveHotelId(hotelName: string, hotels: Hotel[]): string {
  const match = hotels.find(h => hotelLabel(h) === hotelName || h.name === hotelName)
  return match?.id ?? ''
}

const DEFAULT_DATA: VoucherData = {
  voucherNo: '',
  referenceNo: '',
  date: new Date().toISOString().slice(0, 10),
  packageInfo: 'Room (30) Nights',
  familyHead: '',
  companyName: 'Amere Taiba International',
  companyField: 'Amere Taiba International',
  pilgrims: [emptyPilgrim()],
  accommodations: [emptyAccommodation(), { ...emptyAccommodation(), id: uid(), city: 'Madina' }],
  makkahHotelContact: '',
  madinaHotelContact: '',
  makkahTransportContact: '',
  madinaTransportContact: '',
  jeddahTransportContact: '',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  showVisaNumber: true,
  showPassportNumber: true,
  showCompanyName: true,
  showCompanyField: true,
  showLogoPage1: true,
  showLogoPage2: true,
}

// ─── Scaled preview container ──────────────────────────────────────────────────
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? VOUCHER_TEMPLATE_W
      setScale(Math.min(w / VOUCHER_TEMPLATE_W, 1))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scaledH = Math.round(VOUCHER_TEMPLATE_H * scale)

  return (
    <div ref={containerRef} className="w-full">
      <div className="overflow-hidden" style={{ height: scaledH }}>
        <div
          style={{
            width: `${VOUCHER_TEMPLATE_W}px`,
            height: `${VOUCHER_TEMPLATE_H}px`,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Form section wrapper ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-navy">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {children}
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface HotelVoucherFormProps {
  initialSettings: Pick<HotelVoucherSettings, 'urdu_guidelines' | 'urdu_footer'>
  makkahHotels: Hotel[]
  madinahHotels: Hotel[]
  hotelContacts: HotelContact[]
  transportContacts: TransportContact[]
  existingVouchers?: HotelVoucherRecord[]
  canEditGuidelines?: boolean
}

export default function HotelVoucherForm({
  initialSettings,
  makkahHotels,
  madinahHotels,
  hotelContacts,
  transportContacts,
  existingVouchers = [],
  canEditGuidelines = false,
}: HotelVoucherFormProps) {
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null)
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<Set<string>>(new Set())
  const [showAllVouchers, setShowAllVouchers] = useState(false)
  const [isVoucherPending, startVoucherTransition] = useTransition()

  const savedVouchers = showAllVouchers ? existingVouchers : existingVouchers.filter(v => !v.file_deleted_at)
  const router = useRouter()
  const [data, setData] = useState<VoucherData>(DEFAULT_DATA)
  const [previewPage, setPreviewPage] = useState<1 | 2>(1)
  const [isDownloading, setIsDownloading] = useState(false)

  const [urduLines, setUrduLines] = useState<string[]>(() => [...initialSettings.urdu_guidelines])
  const [urduFooter, setUrduFooter] = useState(initialSettings.urdu_footer)

  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [draftGuidelines, setDraftGuidelines] = useState('')
  const [draftFooter, setDraftFooter] = useState('')
  const [isSavingGuidelines, setIsSavingGuidelines] = useState(false)
  const [hotelSelections, setHotelSelections] = useState<Record<string, string>>({})
  const [newHotelForAccommodationId, setNewHotelForAccommodationId] = useState<string | null>(null)
  const [isSavingHotel, startHotelTransition] = useTransition()
  const [logoUrl, setLogoUrl] = useState<string | null>('/logo-for-invoice.png')
  const [logoSize, setLogoSize] = useState(DEFAULT_VOUCHER_LOGO_SIZE)
  const [logoX, setLogoX] = useState(DEFAULT_VOUCHER_LOGO_X)
  const [logoY, setLogoY] = useState(DEFAULT_VOUCHER_LOGO_Y)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [voucherBackground, setVoucherBackground] = useState('/Empty-Hotel-Voucher.jpg')
  const [voucherTextColor, setVoucherTextColor] = useState('#ffffff')

  const logoBox = getVoucherLogoBoxSize(logoSize)
  const logoMaxX = Math.max(0, VOUCHER_INTRINSIC_BG_W - logoBox.w)
  const logoMaxY = Math.max(0, VOUCHER_INTRINSIC_BG_H - logoBox.h)

  const branding: VoucherBranding = { logoUrl, logoX, logoY, logoSize }

  function updateLogoSize(nextSize: number) {
    const size = Math.min(VOUCHER_LOGO_SIZE_MAX, Math.max(VOUCHER_LOGO_SIZE_MIN, nextSize))
    setLogoSize(size)
    const clamped = clampVoucherLogoPosition(logoX, logoY, size)
    setLogoX(clamped.x)
    setLogoY(clamped.y)
  }

  function updateLogoX(nextX: number) {
    setLogoX(clampVoucherLogoPosition(nextX, logoY, logoSize).x)
  }

  function updateLogoY(nextY: number) {
    setLogoY(clampVoucherLogoPosition(logoX, nextY, logoSize).y)
  }

  function resetLogoDefaults() {
    setLogoSize(DEFAULT_VOUCHER_LOGO_SIZE)
    setLogoX(DEFAULT_VOUCHER_LOGO_X)
    setLogoY(DEFAULT_VOUCHER_LOGO_Y)
  }

  const isDefaultLogo =
    logoSize === DEFAULT_VOUCHER_LOGO_SIZE &&
    logoX === DEFAULT_VOUCHER_LOGO_X &&
    logoY === DEFAULT_VOUCHER_LOGO_Y

  // Refs for PDF capture — always rendered in the hidden container
  const page1Ref = useRef<HTMLDivElement>(null)
  const page2Ref = useRef<HTMLDivElement>(null)

  const makkahContactOptions = useMemo(
    () => filterHotelContactsByCity(hotelContacts, 'makkah'),
    [hotelContacts],
  )
  const madinahContactOptions = useMemo(
    () => filterHotelContactsByCity(hotelContacts, 'madinah'),
    [hotelContacts],
  )

  const makkahTransportOptions = useMemo(
    () => filterHotelContactsByCity(transportContacts as HotelContact[], 'makkah'),
    [transportContacts],
  )
  const madinahTransportOptions = useMemo(
    () => filterHotelContactsByCity(transportContacts as HotelContact[], 'madinah'),
    [transportContacts],
  )
  const jeddahTransportOptions = useMemo(
    () => filterHotelContactsByCity(transportContacts as HotelContact[], 'jeddah'),
    [transportContacts],
  )

  function selectMakkahHotelContact(contactId: string) {
    const contact = makkahContactOptions.find(c => c.id === contactId)
    setData(prev => ({
      ...prev,
      makkahHotelContactId: contactId,
      makkahHotelContact: contact?.contact_number ?? '',
    }))
  }

  function selectMadinaHotelContact(contactId: string) {
    const contact = madinahContactOptions.find(c => c.id === contactId)
    setData(prev => ({
      ...prev,
      madinaHotelContactId: contactId,
      madinaHotelContact: contact?.contact_number ?? '',
    }))
  }

  function selectMakkahTransportContact(contactId: string) {
    const contact = makkahTransportOptions.find(c => c.id === contactId)
    setData(prev => ({
      ...prev,
      makkahTransportContactId: contactId,
      makkahTransportContact: contact?.contact_number ?? '',
    }))
  }

  function selectMadinaTransportContact(contactId: string) {
    const contact = madinahTransportOptions.find(c => c.id === contactId)
    setData(prev => ({
      ...prev,
      madinaTransportContactId: contactId,
      madinaTransportContact: contact?.contact_number ?? '',
    }))
  }

  function selectJeddahTransportContact(contactId: string) {
    const contact = jeddahTransportOptions.find(c => c.id === contactId)
    setData(prev => ({
      ...prev,
      jeddahTransportContactId: contactId,
      jeddahTransportContact: contact?.contact_number ?? '',
    }))
  }

  const resolvedMakkahContactId =
    data.makkahHotelContactId
    ?? findHotelContactByNumber(makkahContactOptions, data.makkahHotelContact)?.id
    ?? ''
  const resolvedMadinaContactId =
    data.madinaHotelContactId
    ?? findHotelContactByNumber(madinahContactOptions, data.madinaHotelContact)?.id
    ?? ''

  const resolvedMakkahTransportContactId =
    data.makkahTransportContactId
    ?? findHotelContactByNumber(makkahTransportOptions, data.makkahTransportContact)?.id
    ?? ''
  const resolvedMadinaTransportContactId =
    data.madinaTransportContactId
    ?? findHotelContactByNumber(madinahTransportOptions, data.madinaTransportContact)?.id
    ?? ''
  const resolvedJeddahTransportContactId =
    data.jeddahTransportContactId
    ?? findHotelContactByNumber(jeddahTransportOptions, data.jeddahTransportContact)?.id
    ?? ''

  const selectedMakkahContact = makkahContactOptions.find(c => c.id === resolvedMakkahContactId)
  const selectedMadinaContact = madinahContactOptions.find(c => c.id === resolvedMadinaContactId)

  const selectedMakkahTransportContact = makkahTransportOptions.find(c => c.id === resolvedMakkahTransportContactId)
  const selectedMadinaTransportContact = madinahTransportOptions.find(c => c.id === resolvedMadinaTransportContactId)
  const selectedJeddahTransportContact = jeddahTransportOptions.find(c => c.id === resolvedJeddahTransportContactId)

  // ── State helpers ────────────────────────────────────────────────────────────
  function setField<K extends keyof VoucherData>(key: K, value: VoucherData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function updatePilgrim(id: string, patch: Partial<Pilgrim>) {
    setData(prev => ({
      ...prev,
      pilgrims: prev.pilgrims.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }
  function addPilgrim() { setData(prev => ({ ...prev, pilgrims: [...prev.pilgrims, emptyPilgrim()] })) }
  function removePilgrim(id: string) {
    setData(prev => ({ ...prev, pilgrims: prev.pilgrims.filter(p => p.id !== id) }))
  }

  function updateAccommodation(id: string, patch: Partial<Accommodation>) {
    setData(prev => ({
      ...prev,
      accommodations: prev.accommodations.map(a => {
        if (a.id !== id) return a
        const updated = { ...a, ...patch }
        if ('checkIn' in patch || 'nights' in patch) {
          updated.checkOut = calcCheckOut(updated.checkIn, updated.nights)
        }
        return updated
      }),
    }))
  }

  function handleHotelSelect(accommodationId: string, hotelId: string, city: string) {
    const hotels = hotelsForCity(city, makkahHotels, madinahHotels)
    const hotel = hotels.find(h => h.id === hotelId)
    if (!hotel) return
    setHotelSelections(prev => ({ ...prev, [accommodationId]: hotelId }))
    updateAccommodation(accommodationId, { hotelName: hotelLabel(hotel) })
  }

  function handleAccommodationCityChange(accommodationId: string, city: string) {
    updateAccommodation(accommodationId, { city, hotelName: '' })
    setHotelSelections(prev => {
      const next = { ...prev }
      delete next[accommodationId]
      return next
    })
  }

  function handleNewHotelSubmit(formData: FormData) {
    startHotelTransition(async () => {
      const result = await upsertHotel(formData)
      if (result && 'error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Hotel saved!')
      const accommodationId = newHotelForAccommodationId
      setNewHotelForAccommodationId(null)
      router.refresh()
      if (accommodationId) {
        const city = formData.get('city') as string
        const name = (formData.get('name') as string).trim()
        const distance = (formData.get('distance') as string) || ''
        updateAccommodation(accommodationId, { hotelName: `${name} | ${distance}` })
      }
    })
  }
  function addAccommodation() { setData(prev => ({ ...prev, accommodations: [...prev.accommodations, emptyAccommodation()] })) }
  function removeAccommodation(id: string) {
    setData(prev => ({ ...prev, accommodations: prev.accommodations.filter(a => a.id !== id) }))
  }

  // Preload Jameel Noori Nastaleeq for live preview
  useEffect(() => { void ensureUrduFont() }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > VOUCHER_LOGO_MAX_BYTES) {
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

  function openGuidelinesDialog() {
    setDraftGuidelines(urduLines.join('\n'))
    setDraftFooter(urduFooter)
    setGuidelinesOpen(true)
  }

  async function handleSaveGuidelines() {
    const lines = draftGuidelines.split('\n').map(l => l.trim()).filter(Boolean)
    const footer = draftFooter.trim()

    if (lines.length === 0) {
      toast.error('Add at least one guideline line.')
      return
    }
    if (!footer) {
      toast.error('Footer text is required.')
      return
    }

    setIsSavingGuidelines(true)
    try {
      const result = await updateHotelVoucherGuidelines({
        urdu_guidelines: lines,
        urdu_footer: footer,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      setUrduLines(lines)
      setUrduFooter(footer)
      setGuidelinesOpen(false)
      toast.success('Urdu guidelines saved for all future vouchers.')
    } catch {
      toast.error('Could not save guidelines.')
    } finally {
      setIsSavingGuidelines(false)
    }
  }

  const generateVoucherPdfBytes = useCallback(async (): Promise<Uint8Array> => {
    const p1 = page1Ref.current
    const p2 = page2Ref.current
    if (!p1 || !p2) throw new Error('Template refs not ready')

    await ensureUrduFont()

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])

    const SCALE = 2
    const origin = window.location.origin
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

    const bgImg = await loadImage(`${origin}${voucherBackground}`)
    const logoImg = logoUrl ? await loadImage(logoUrl) : null

    const contentCanvas1 = await html2canvas(p1, {
      scale: SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove())
        applyVoucherPdfCloneStyles(clonedDoc)
        clonedDoc.querySelectorAll<HTMLElement>('[data-bg]').forEach(el => { el.style.display = 'none' })
        clonedDoc.querySelectorAll<HTMLElement>('[data-voucher-p1]').forEach(el => { el.style.backgroundColor = 'transparent' })
        hideBrandingLogoInClone(clonedDoc)
        clonedDoc.querySelectorAll<HTMLElement>('[data-grid-cell-text]').forEach(el => {
          el.style.top = el.dataset.cellHeader === '1' ? '3px' : '1px'
          el.style.lineHeight = '11px'
          el.style.fontFamily = 'Arial, Helvetica, sans-serif'
          el.style.color = voucherTextColor
        })
        clonedDoc.querySelectorAll<HTMLElement>('[data-section-header-text]').forEach(el => {
          el.style.top = '3px'
          el.style.lineHeight = '13px'
          el.style.fontFamily = 'Arial, Helvetica, sans-serif'
          el.style.color = voucherTextColor
        })
        clonedDoc.querySelectorAll<HTMLElement>('[data-grid-cell]').forEach(el => {
          const isHeader = el.querySelector('[data-cell-header="1"]')
          el.style.backgroundColor = isHeader ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.08)'
        })
        clonedDoc.querySelectorAll<HTMLElement>('[data-section-header]').forEach(el => {
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.14)'
        })
        clonedDoc.querySelectorAll<HTMLElement>('[data-meta-field]').forEach(el => {
          el.style.position = 'relative'
          el.style.boxSizing = 'border-box'
          el.style.width = '100%'
          el.style.maxWidth = '100%'
          el.style.minWidth = '0'
          el.style.height = '32px'
          el.style.padding = '0'
          el.style.overflow = 'visible'
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
          el.style.border = '1px solid rgba(255, 255, 255, 0.35)'
          el.style.borderRadius = '6px'
          el.style.backdropFilter = 'none'
          el.style.setProperty('-webkit-backdrop-filter', 'none')
        })
        // GridCell header: top 7→3; meta top 8→5 (same 3px html2canvas offset)
        clonedDoc.querySelectorAll<HTMLElement>('[data-meta-field-text]').forEach(el => {
          el.style.position = 'absolute'
          el.style.top = '0px'
          el.style.left = '12px'
          el.style.right = '12px'
          el.style.lineHeight = '16px'
          el.style.fontSize = '16px'
          el.style.fontFamily = 'Arial, Helvetica, sans-serif'
          el.style.color = voucherTextColor
          el.style.margin = '0'
          el.style.padding = '0'
          el.style.whiteSpace = 'nowrap'
        })
      },
    })

    const composite1 = document.createElement('canvas')
    composite1.width = Math.round(VOUCHER_TEMPLATE_W * SCALE)
    composite1.height = Math.round(VOUCHER_TEMPLATE_H * SCALE)
    const ctx1 = composite1.getContext('2d')!
    ctx1.imageSmoothingEnabled = true
    ctx1.imageSmoothingQuality = 'high'
    ctx1.drawImage(bgImg, 0, 0, composite1.width, composite1.height)
    ctx1.drawImage(contentCanvas1, 0, 0)
    if (logoImg && data.showLogoPage1 !== false) drawVoucherLogoOnCanvas(ctx1, logoImg, branding, SCALE)
    pdf.addImage(composite1.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297)

    pdf.addPage()
    const contentCanvas2 = await captureUrduPage(p2, html2canvas, SCALE)
    const composite2 = document.createElement('canvas')
    composite2.width = Math.round(VOUCHER_TEMPLATE_W * SCALE)
    composite2.height = Math.round(VOUCHER_TEMPLATE_H * SCALE)
    const ctx2 = composite2.getContext('2d')!
    ctx2.imageSmoothingEnabled = true
    ctx2.imageSmoothingQuality = 'high'
    ctx2.drawImage(bgImg, 0, 0, composite2.width, composite2.height)
    ctx2.drawImage(contentCanvas2, 0, 0)
    if (logoImg && data.showLogoPage2 !== false) drawVoucherLogoOnCanvas(ctx2, logoImg, branding, SCALE)
    pdf.addImage(composite2.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297)

    return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer)
  }, [logoUrl, logoX, logoY, logoSize, voucherBackground, voucherTextColor])

  const handleSaveAndDownload = useCallback(async () => {
    if (!data.familyHead.trim()) {
      toast.error('Family head name is required.')
      return
    }
    setIsDownloading(true)
    try {
      const bytes = await generateVoucherPdfBytes()
      const payload = {
        voucher_date: data.date,
        reference_no: data.referenceNo,
        family_head: data.familyHead,
        package_info: data.packageInfo,
        voucher_data: {
          ...data,
          backgroundImage: voucherBackground,
          textColor: voucherTextColor,
        },
        pdf_base64: uint8ToBase64(bytes),
      }
      const persist = () => editingVoucherId
        ? updateHotelVoucherWithPdf({ id: editingVoucherId, ...payload })
        : createHotelVoucherWithPdf(payload)

      const result = await persist()
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if (!('success' in result) || !result.success) return

      const fileNo = ('voucher_number' in result && result.voucher_number)
        ? result.voucher_number
        : (editingVoucherId ? savedVouchers.find(v => v.id === editingVoucherId)?.voucher_number : 'voucher')

      downloadPdfBytes(bytes, `${fileNo}.pdf`)
      toast.success(editingVoucherId ? 'Voucher updated and downloaded.' : `Voucher ${fileNo} saved and downloaded.`)
      if (editingVoucherId) {
        setEditingVoucherId(null)
        setData(DEFAULT_DATA)
        setVoucherBackground('/Empty-Hotel-Voucher.jpg')
        setVoucherTextColor('#ffffff')
      }
      router.refresh()
    } catch (err) {
      console.error('[PDF] save error:', err)
      toast.error(err instanceof Error ? err.message : 'Could not save voucher.')
    } finally {
      setIsDownloading(false)
    }
  }, [data, generateVoucherPdfBytes, editingVoucherId, router, savedVouchers, voucherBackground, voucherTextColor])

  async function handleStoredDownload(v: HotelVoucherRecord) {
    if (v.file_deleted_at) {
      toast.error(`File removed — storage was freed on ${v.file_deleted_at.split('T')[0]}.`)
      return
    }
    if (!v.storage_key) {
      toast.error('No stored PDF for this voucher.')
      return
    }
    setIsDownloading(true)
    try {
      await downloadStoredPdf(v.id, 'voucher')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleEdit(v: HotelVoucherRecord) {
    const vData = v.voucher_data as any
    setData(vData)
    if (vData.backgroundImage) setVoucherBackground(vData.backgroundImage)
    if (vData.textColor) setVoucherTextColor(vData.textColor)
    setEditingVoucherId(v.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info(`Voucher ${v.voucher_number} loaded in editor.`)
  }

  function handleCancelEdit() {
    setEditingVoucherId(null)
    setData(DEFAULT_DATA)
    setVoucherBackground('/Empty-Hotel-Voucher.jpg')
    setVoucherTextColor('#ffffff')
    toast.info('Editor reset.')
  }

  function toggleVoucherSelect(id: string, checked: boolean) {
    setSelectedVoucherIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAllVouchers(checked: boolean) {
    if (checked) {
      setSelectedVoucherIds(new Set(savedVouchers.map(v => v.id)))
    } else {
      setSelectedVoucherIds(new Set())
    }
  }

  async function handleBulkDelete() {
    if (selectedVoucherIds.size === 0) return
    if (!confirm(`Delete ${selectedVoucherIds.size} selected voucher(s)? This cannot be undone.`)) return

    startVoucherTransition(async () => {
      const ids = [...selectedVoucherIds]
      const result = await deleteHotelVouchers(ids)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Selected voucher(s) deleted.')
        setSelectedVoucherIds(new Set())
        router.refresh()
      }
    })
  }

  async function handleDeleteVoucher(v: HotelVoucherRecord) {
    if (!confirm(`Delete voucher ${v.voucher_number}? This cannot be undone.`)) return
    startVoucherTransition(async () => {
      const result = await deleteHotelVoucher(v.id)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Voucher ${v.voucher_number} deleted.`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-6">

        {/* ── LEFT: Form ──────────────────────────────────────────────────────── */}
        <div className="hvf-form xl:w-[46%] shrink-0 space-y-4">

          {/* Voucher Info */}
          <Section title="Voucher Information">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 min-w-0">
                <Label className="text-xs">Voucher No</Label>
                <Input placeholder="1502" value={data.voucherNo}
                  onChange={e => setField('voucherNo', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label className="text-xs">Reference No</Label>
                <Input placeholder="ATT-1502" value={data.referenceNo}
                  onChange={e => setField('referenceNo', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={data.date}
                  onChange={e => setField('date', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                <Label className="text-xs">Family Head (Name)</Label>
                <Input placeholder="SHAKIL AHMAD" value={data.familyHead}
                  onChange={e => setField('familyHead', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2 min-w-0">
                <Label className="text-xs">Package Info</Label>
                <Input placeholder="Room (30) Nights" value={data.packageInfo}
                  onChange={e => setField('packageInfo', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Company Name (header on voucher)</Label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                    <Checkbox
                      checked={data.showCompanyName !== false}
                      onCheckedChange={v => setField('showCompanyName', Boolean(v))}
                    />
                    <span className="text-xs font-medium">Show</span>
                  </label>
                </div>
                {data.showCompanyName !== false && (
                  <Input placeholder="Amere Taiba International" value={data.companyName}
                    onChange={e => setField('companyName', e.target.value)} className="h-8 text-sm" />
                )}
              </div>
              <div className="space-y-1 col-span-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Company Name (metadata table field)</Label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                    <Checkbox
                      checked={data.showCompanyField !== false}
                      onCheckedChange={v => setField('showCompanyField', Boolean(v))}
                    />
                    <span className="text-xs font-medium">Show</span>
                  </label>
                </div>
                {data.showCompanyField !== false && (
                  <Input placeholder="Amere Taiba International" value={data.companyField !== undefined ? data.companyField : 'Amere Taiba International'}
                    onChange={e => setField('companyField', e.target.value)} className="h-8 text-sm" />
                )}
              </div>
            </div>
          </Section>

          {/* Pilgrims */}
          <Section title="Pilgrims Details">
            <div className="space-y-3">
              {data.pilgrims.map((p, i) => (
                <div key={p.id} className="border rounded-md p-3 space-y-2 relative bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">Pilgrim {i + 1}</span>
                    {data.pilgrims.length > 1 && (
                      <button onClick={() => removePilgrim(p.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Mutamer Name</Label>
                      <Input placeholder="Full name" value={p.name}
                        onChange={e => updatePilgrim(p.id, { name: e.target.value })}
                        className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Passport No</Label>
                        {i === 0 && (
                          <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                            <Checkbox
                              checked={data.showPassportNumber !== false}
                              onCheckedChange={v => setField('showPassportNumber', Boolean(v))}
                            />
                            <span className="text-xs font-medium">Show</span>
                          </label>
                        )}
                      </div>
                      {data.showPassportNumber !== false && (
                        <Input placeholder="AB1234567" value={p.passportNo}
                          onChange={e => updatePilgrim(p.id, { passportNo: e.target.value })}
                          className="h-7 text-xs" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Visa Number</Label>
                        {i === 0 && (
                          <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                            <Checkbox
                              checked={data.showVisaNumber}
                              onCheckedChange={v => setField('showVisaNumber', Boolean(v))}
                            />
                            <span className="text-xs font-medium">Show</span>
                          </label>
                        )}
                      </div>
                      {data.showVisaNumber && (
                        <Input placeholder="Visa No" value={p.visaNumber}
                          onChange={e => updatePilgrim(p.id, { visaNumber: e.target.value })}
                          className="h-7 text-xs" />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Pax</Label>
                        <Input type="number" min="1" value={p.pax}
                          onChange={e => updatePilgrim(p.id, { pax: e.target.value })}
                          className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Beds</Label>
                        <Input type="number" min="1" value={p.beds}
                          onChange={e => updatePilgrim(p.id, { beds: e.target.value })}
                          className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Gender</Label>
                        <select value={p.gender || 'M'}
                          onChange={e => updatePilgrim(p.id, { gender: e.target.value })}
                          className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addPilgrim}
                className="w-full h-8 text-xs gap-1.5 border-dashed">
                <Plus className="w-3.5 h-3.5" /> Add Pilgrim
              </Button>
            </div>
          </Section>

          {/* Accommodations */}
          <Section title="Accommodation Details">
            <div className="space-y-3">
              {data.accommodations.map((a, i) => {
                const cityHotels = hotelsForCity(a.city, makkahHotels, madinahHotels)
                const selectedHotelId = hotelSelections[a.id] || resolveHotelId(a.hotelName, cityHotels)
                const useHotelDropdown = a.city === 'Makkah' || a.city === 'Madina'

                return (
                  <div key={a.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">Hotel {i + 1}</span>
                      {data.accommodations.length > 1 && (
                        <button onClick={() => removeAccommodation(a.id)}
                          className="text-destructive hover:text-destructive/80 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">City</Label>
                        <select value={a.city}
                          onChange={e => handleAccommodationCityChange(a.id, e.target.value)}
                          className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                          <option value="Makkah">Makkah</option>
                          <option value="Madina">Madina</option>
                          <option value="Jeddah">Jeddah</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Confirmation No</Label>
                        <Input placeholder="CONF-001" value={a.confirmNo}
                          onChange={e => updateAccommodation(a.id, { confirmNo: e.target.value })}
                          className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-xs">Hotel Name</Label>
                            {useHotelDropdown && (
                              <label className="flex items-center gap-1 cursor-pointer select-none">
                                <Checkbox
                                  checked={!!a.isCustom}
                                  onCheckedChange={v => updateAccommodation(a.id, { isCustom: Boolean(v) })}
                                />
                                <span className="text-[10px] font-medium text-muted-foreground">Custom Name</span>
                              </label>
                            )}
                          </div>
                          {useHotelDropdown && !a.isCustom && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => setNewHotelForAccommodationId(a.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> New Hotel
                            </Button>
                          )}
                        </div>
                        {useHotelDropdown && !a.isCustom ? (
                          <Select
                            items={cityHotels.map(h => ({ value: h.id, label: hotelLabel(h) }))}
                            value={selectedHotelId || null}
                            onValueChange={v => { if (v) handleHotelSelect(a.id, v, a.city) }}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue placeholder="Select hotel" />
                            </SelectTrigger>
                            <SelectContent>
                              {cityHotels.map(h => (
                                <SelectItem key={h.id} value={h.id} label={hotelLabel(h)}>
                                  {hotelLabel(h)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input placeholder="Hotel name (e.g. 4 Star Hotel)" value={a.hotelName}
                            onChange={e => updateAccommodation(a.id, { hotelName: e.target.value })}
                            className="h-7 text-xs" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Room Type</Label>
                        <select value={a.roomType || 'Room'}
                          onChange={e => updateAccommodation(a.id, { roomType: e.target.value })}
                          className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                          {VOUCHER_ROOM_TYPES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meal Plan</Label>
                        <select value={a.mealPlan}
                          onChange={e => updateAccommodation(a.id, { mealPlan: e.target.value })}
                          className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                          <option value="BB">BB (Bed & Breakfast)</option>
                          <option value="HB">HB (Half Board)</option>
                          <option value="FB">FB (Full Board)</option>
                          <option value="RO">RO (Room Only)</option>
                        </select>
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                        <Label className="text-xs">Check In</Label>
                        <Input type="date" value={a.checkIn}
                          onChange={e => updateAccommodation(a.id, { checkIn: e.target.value })}
                          className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nights</Label>
                        <Input type="number" min="1" placeholder="7" value={a.nights}
                          onChange={e => updateAccommodation(a.id, { nights: e.target.value })}
                          className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                        <Label className="text-xs">Check Out (auto)</Label>
                        <Input type="date" value={a.checkOut} readOnly
                          className="h-7 text-xs bg-muted/50" />
                      </div>
                    </div>
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" onClick={addAccommodation}
                className="w-full h-8 text-xs gap-1.5 border-dashed">
                <Plus className="w-3.5 h-3.5" /> Add Hotel
              </Button>
            </div>
          </Section>

          {/* Contact & Timing */}
          <Section title="Contact &amp; Timing Notes">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Makkah Hotel Contact</Label>
                {makkahContactOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Add contacts in Settings → Hotel Contacts.
                  </p>
                ) : (
                  <>
                    <Select
                      value={resolvedMakkahContactId || ""}
                      onValueChange={v => v && selectMakkahHotelContact(v)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder="Select hotel (name · city)">
                          {selectedMakkahContact ? hotelContactLabel(selectedMakkahContact) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {makkahContactOptions.map(c => (
                          <SelectItem key={c.id} value={c.id} label={hotelContactLabel(c)}>
                            {hotelContactLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.makkahHotelContact && (
                      <p className="text-[10px] text-muted-foreground">Voucher shows: {data.makkahHotelContact}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Madina Hotel Contact</Label>
                {madinahContactOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Add contacts in Settings → Hotel Contacts.
                  </p>
                ) : (
                  <>
                    <Select
                      value={resolvedMadinaContactId || ""}
                      onValueChange={v => v && selectMadinaHotelContact(v)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder="Select hotel (name · city)">
                          {selectedMadinaContact ? hotelContactLabel(selectedMadinaContact) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {madinahContactOptions.map(c => (
                          <SelectItem key={c.id} value={c.id} label={hotelContactLabel(c)}>
                            {hotelContactLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.madinaHotelContact && (
                      <p className="text-[10px] text-muted-foreground">Voucher shows: {data.madinaHotelContact}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Makkah Transport Contact</Label>
                {makkahTransportOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Add contacts in Settings → Transport Contacts.
                  </p>
                ) : (
                  <>
                    <Select
                      value={resolvedMakkahTransportContactId || ""}
                      onValueChange={v => v && selectMakkahTransportContact(v)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder="Select contact (name · city)">
                          {selectedMakkahTransportContact ? hotelContactLabel(selectedMakkahTransportContact) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {makkahTransportOptions.map(c => (
                          <SelectItem key={c.id} value={c.id} label={hotelContactLabel(c)}>
                            {hotelContactLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.makkahTransportContact && (
                      <p className="text-[10px] text-muted-foreground">Voucher shows: {data.makkahTransportContact}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Madina Transport Contact</Label>
                {madinahTransportOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Add contacts in Settings → Transport Contacts.
                  </p>
                ) : (
                  <>
                    <Select
                      value={resolvedMadinaTransportContactId || ""}
                      onValueChange={v => v && selectMadinaTransportContact(v)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder="Select contact (name · city)">
                          {selectedMadinaTransportContact ? hotelContactLabel(selectedMadinaTransportContact) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {madinahTransportOptions.map(c => (
                          <SelectItem key={c.id} value={c.id} label={hotelContactLabel(c)}>
                            {hotelContactLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.madinaTransportContact && (
                      <p className="text-[10px] text-muted-foreground">Voucher shows: {data.madinaTransportContact}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Jeddah Transport Contact</Label>
                {jeddahTransportOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Add contacts in Settings → Transport Contacts.
                  </p>
                ) : (
                  <>
                    <Select
                      value={resolvedJeddahTransportContactId || ""}
                      onValueChange={v => v && selectJeddahTransportContact(v)}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder="Select contact (name · city)">
                          {selectedJeddahTransportContact ? hotelContactLabel(selectedJeddahTransportContact) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {jeddahTransportOptions.map(c => (
                          <SelectItem key={c.id} value={c.id} label={hotelContactLabel(c)}>
                            {hotelContactLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.jeddahTransportContact && (
                      <p className="text-[10px] text-muted-foreground">Voucher shows: {data.jeddahTransportContact}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                <Label className="text-xs">Check-In Time</Label>
                <Input type="time" value={data.checkInTime}
                  onChange={e => setField('checkInTime', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1 min-w-0">
                <Label className="text-xs">Check-Out Time</Label>
                <Input type="time" value={data.checkOutTime}
                  onChange={e => setField('checkOutTime', e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </Section>

          <Section title="Appearance">
            <InvoiceAppearanceControls
              backgroundSrc={voucherBackground}
              onBackgroundChange={setVoucherBackground}
              textColor={voucherTextColor}
              onTextColorChange={setVoucherTextColor}
              defaultBackground="/Empty-Hotel-Voucher.jpg"
              defaultTextColor="#ffffff"
              backgrounds={VOUCHER_BACKGROUNDS}
            />
          </Section>

          <Section title="Branding">
            <p className="text-[10px] text-muted-foreground mb-2">
              Logo stays in your browser only until download — not uploaded or stored on the server.
            </p>
            <div className="flex items-center gap-4 py-2 border-b border-dashed mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox
                  checked={data.showLogoPage1 !== false}
                  onCheckedChange={v => setField('showLogoPage1', Boolean(v))}
                />
                <span className="text-xs font-medium">Show Logo Page 1</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox
                  checked={data.showLogoPage2 !== false}
                  onCheckedChange={v => setField('showLogoPage2', Boolean(v))}
                />
                <span className="text-xs font-medium">Show Logo Page 2</span>
              </label>
            </div>
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
                  label="Logo Size (width)"
                  value={logoSize}
                  min={VOUCHER_LOGO_SIZE_MIN}
                  max={VOUCHER_LOGO_SIZE_MAX}
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
          </Section>

          <div className="flex gap-2">
            {editingVoucherId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1 h-10 text-xs"
              >
                Cancel Edit
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSaveAndDownload}
              disabled={isDownloading}
              className="flex-1 gap-2 bg-navy hover:bg-navy/90 text-white h-10 text-xs"
            >
              <Download className="w-4 h-4" />
              {isDownloading
                ? 'Saving PDF…'
                : (editingVoucherId ? 'Update & Download' : 'Save & Download Voucher')
              }
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Preview + Download ─────────────────────────────────────────── */}
        <div className="hvf-preview-wrap min-w-0 w-full xl:flex-1 xl:sticky xl:top-6 xl:self-start space-y-3">

          {/* Page toggle + download button */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
              <button
                onClick={() => setPreviewPage(1)}
                className={`px-3 py-1.5 transition-colors ${previewPage === 1 ? 'bg-navy text-white' : 'bg-background hover:bg-muted'}`}
              >
                <Eye className="w-3 h-3 inline mr-1" />Page 1 (English)
              </button>
              <button
                onClick={() => setPreviewPage(2)}
                className={`px-3 py-1.5 transition-colors ${previewPage === 2 ? 'bg-navy text-white' : 'bg-background hover:bg-muted'}`}
              >
                <Eye className="w-3 h-3 inline mr-1" />Page 2 (اردو)
              </button>
            </div>
            {canEditGuidelines && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openGuidelinesDialog}
                className="h-8 text-xs gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Change Guidelines
              </Button>
            )}
            <Button
              onClick={handleSaveAndDownload}
              disabled={isDownloading}
              className="ml-auto gap-2 bg-navy hover:bg-navy/90 text-white h-8 text-xs"
              size="sm"
            >
              <Download className="w-3.5 h-3.5" />
              {isDownloading
                ? 'Saving PDF…'
                : (editingVoucherId ? 'Update & Download' : 'Save & Download Voucher')
              }
            </Button>
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-hidden bg-muted/20 shadow-sm">
            <ScaledPreview>
              {previewPage === 1
                ? <VoucherPage1 data={data} branding={branding} backgroundImage={voucherBackground} textColor={voucherTextColor} />
                : <VoucherPage2 data={data} urduLines={urduLines} urduFooter={urduFooter} branding={branding} backgroundImage={voucherBackground} textColor={voucherTextColor} />
              }
            </ScaledPreview>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Live preview — both pages are included in the downloaded PDF
          </p>
        </div>

        {/* ── Hidden capture targets (always in DOM, invisible) ───────────────── */}
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <VoucherPage1 ref={page1Ref} data={data} branding={branding} backgroundImage={voucherBackground} textColor={voucherTextColor} />
            <VoucherPage2 ref={page2Ref} data={data} urduLines={urduLines} urduFooter={urduFooter} branding={branding} backgroundImage={voucherBackground} textColor={voucherTextColor} />
          </div>
        </div>

        <Dialog open={!!newHotelForAccommodationId} onOpenChange={open => !open && setNewHotelForAccommodationId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Hotel</DialogTitle>
            </DialogHeader>
            {(() => {
              const acc = data.accommodations.find(a => a.id === newHotelForAccommodationId)
              const city = acc?.city === 'Madina' ? 'Madinah' : 'Makkah'
              return (
                <form action={handleNewHotelSubmit} className="space-y-4">
                  <input type="hidden" name="city" value={city} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">City</Label>
                      <Input value={city} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Hotel Name</Label>
                      <Input name="name" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Distance</Label>
                      <Input name="distance" placeholder="e.g. 200 MTR" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contact Number</Label>
                      <Input name="contact_number" placeholder="+966 12 000 0000" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Location (optional)</Label>
                      <Input name="location" />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {['room', 'sharing', 'quad', 'triple', 'double'].map(r => (
                      <div key={r} className="space-y-1.5">
                        <Label className="text-xs capitalize">{r} SAR</Label>
                        <Input type="number" name={`${r}_sar`} min={0} defaultValue={0} />
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setNewHotelForAccommodationId(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSavingHotel} className="bg-navy hover:bg-navy/90 text-white">
                      {isSavingHotel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Hotel
                    </Button>
                  </DialogFooter>
                </form>
              )
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={guidelinesOpen} onOpenChange={setGuidelinesOpen}>
          <DialogContent className="max-w-2xl sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Change Urdu Guidelines (Page 2)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Guidelines — one line per numbered point</Label>
                <textarea
                  value={draftGuidelines}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraftGuidelines(e.target.value)}
                  rows={14}
                  dir="rtl"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Footer declaration</Label>
                <textarea
                  value={draftFooter}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraftFooter(e.target.value)}
                  rows={2}
                  dir="rtl"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Saved guidelines apply to all future hotel vouchers for your organization.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGuidelinesOpen(false)}
                disabled={isSavingGuidelines}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveGuidelines}
                disabled={isSavingGuidelines}
                className="bg-navy hover:bg-navy/90 text-white"
              >
                {isSavingGuidelines ? 'Saving…' : 'Save Guidelines'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(existingVouchers.length > 0 || savedVouchers.length > 0) && (
        <Card className="border shadow-sm mt-6">
          <CardHeader className="pb-3 pt-4 px-6 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
            <div>
              <CardTitle className="text-base">Saved Vouchers</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage and search saved hotel vouchers
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                <Checkbox
                  checked={showAllVouchers}
                  onCheckedChange={v => {
                    setShowAllVouchers(Boolean(v))
                    setSelectedVoucherIds(new Set())
                  }}
                />
                Include Vouchers with deleted PDFs
              </label>
              {selectedVoucherIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isVoucherPending}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedVoucherIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/30 text-left border-b">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={savedVouchers.length > 0 && savedVouchers.every(v => selectedVoucherIds.has(v.id))}
                      onCheckedChange={checked => toggleAllVouchers(checked === true)}
                      aria-label="Select all vouchers"
                    />
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voucher #</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Family Head</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Package Info</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PDF Status</th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {savedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                      No vouchers match the filter.
                    </td>
                  </tr>
                ) : (
                  savedVouchers.map(v => {
                    const isSelected = selectedVoucherIds.has(v.id)
                    const hasFile = v.storage_key && !v.file_deleted_at
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={checked => toggleVoucherSelect(v.id, checked === true)}
                            aria-label={`Select voucher ${v.voucher_number}`}
                          />
                        </td>
                        <td className="p-3 font-semibold text-navy text-xs font-mono">{v.voucher_number}</td>
                        <td className="p-3 text-sm font-medium">{v.family_head}</td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]" title={v.package_info}>
                          {v.package_info || '—'}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{v.voucher_date}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${hasFile
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            {hasFile ? 'Stored PDF' : 'PDF Deleted'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(v)}
                              title="Edit Voucher"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              disabled={!hasFile || isDownloading}
                              onClick={() => handleStoredDownload(v)}
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isVoucherPending}
                              onClick={() => handleDeleteVoucher(v)}
                              title="Delete Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
