'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { VoucherPage1, VoucherPage2 } from './HotelVoucherTemplate'
import type { VoucherData, Pilgrim, Accommodation } from './HotelVoucherTemplate'
import { JAMEEL_WOFF } from './HotelVoucherTemplate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, Download, Eye, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { updateHotelVoucherGuidelines } from '@/app/actions/hotel-voucher'
import { createHotelVoucherWithPdf } from '@/app/actions/hotel-vouchers'
import { downloadPdfBytes, downloadStoredPdf } from '@/lib/storage-client'
import { uint8ToBase64 } from '@/lib/pdf-utils'
import type { HotelVoucherSettings, HotelVoucherRecord } from '@/lib/types'
import { BrandingSlider } from '@/components/branding/BrandingSlider'
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
  VOUCHER_LOGO_SIZE_MAX,
  VOUCHER_LOGO_SIZE_MIN,
  VOUCHER_TEMPLATE_H,
  VOUCHER_TEMPLATE_W,
  type VoucherBranding,
} from '@/lib/hotel-voucher-branding-layout'

const JAMEEL_WOFF_URL = JAMEEL_WOFF

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
  return { id: uid(), name: '', passportNo: '', pax: '1', beds: '1', visaNumber: '', pnr: '' }
}

function emptyAccommodation(): Accommodation {
  return { id: uid(), hotelName: '', confirmNo: '', city: 'Makkah', roomType: '', mealPlan: 'BB', checkIn: '', checkOut: '', nights: '' }
}

const DEFAULT_DATA: VoucherData = {
  voucherNo: '',
  referenceNo: '',
  date: new Date().toISOString().slice(0, 10),
  packageInfo: '',
  familyHead: '',
  pilgrims: [emptyPilgrim()],
  accommodations: [emptyAccommodation(), { ...emptyAccommodation(), id: uid(), city: 'Madina' }],
  makkahHotelContact: '',
  madinaHotelContact: '',
  checkInTime: '14:00',
  checkOutTime: '12:00',
}

// ─── Scaled preview container ──────────────────────────────────────────────────
const PAGE_W = 794

function ScaledPreview({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? PAGE_W
      setScale(Math.min(w / PAGE_W, 1))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <div style={{
        width: `${PAGE_W}px`,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
      }}>
        {children}
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
  existingVouchers?: HotelVoucherRecord[]
  canEditGuidelines?: boolean
}

export default function HotelVoucherForm({ initialSettings, existingVouchers = [], canEditGuidelines = false }: HotelVoucherFormProps) {
  const savedVouchers = existingVouchers.filter(v => !v.file_deleted_at)
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(DEFAULT_VOUCHER_LOGO_SIZE)
  const [logoX, setLogoX] = useState(DEFAULT_VOUCHER_LOGO_X)
  const [logoY, setLogoY] = useState(DEFAULT_VOUCHER_LOGO_Y)
  const logoInputRef = useRef<HTMLInputElement>(null)

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

  // Refs for PDF capture — always rendered in the hidden container
  const page1Ref = useRef<HTMLDivElement>(null)
  const page2Ref = useRef<HTMLDivElement>(null)

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
      accommodations: prev.accommodations.map(a => a.id === id ? { ...a, ...patch } : a),
    }))
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

    const bgImg = await loadImage(`${origin}/Empty-Hotel-Voucher.jpg`)
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
        clonedDoc.querySelectorAll<HTMLElement>('[data-bg]').forEach(el => { el.style.display = 'none' })
        clonedDoc.querySelectorAll<HTMLElement>('[data-voucher-p1]').forEach(el => { el.style.backgroundColor = 'transparent' })
        hideBrandingLogoInClone(clonedDoc)
        clonedDoc.querySelectorAll<HTMLElement>('[data-grid-cell-text]').forEach(el => {
          el.style.top = el.dataset.cellHeader === '1' ? '3px' : '1px'
          el.style.lineHeight = '11px'
          el.style.fontFamily = 'Arial, Helvetica, sans-serif'
          el.style.color = '#ffffff'
        })
        clonedDoc.querySelectorAll<HTMLElement>('[data-section-header-text]').forEach(el => {
          el.style.top = '3px'
          el.style.lineHeight = '13px'
          el.style.fontFamily = 'Arial, Helvetica, sans-serif'
          el.style.color = '#ffffff'
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
          el.style.color = '#ffffff'
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
    if (logoImg) drawVoucherLogoOnCanvas(ctx1, logoImg, branding, SCALE)
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
    if (logoImg) drawVoucherLogoOnCanvas(ctx2, logoImg, branding, SCALE)
    pdf.addImage(composite2.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297)

    return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer)
  }, [logoUrl, logoX, logoY, logoSize])

  const handleSaveAndDownload = useCallback(async () => {
    if (!data.familyHead.trim()) {
      toast.error('Family head name is required.')
      return
    }
    setIsDownloading(true)
    try {
      const bytes = await generateVoucherPdfBytes()
      const result = await createHotelVoucherWithPdf({
        voucher_date: data.date,
        reference_no: data.referenceNo,
        family_head: data.familyHead,
        package_info: data.packageInfo,
        voucher_data: data,
        pdf_base64: uint8ToBase64(bytes),
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if (!('success' in result) || !result.success) return
      downloadPdfBytes(bytes, `${result.voucher_number}.pdf`)
      toast.success(`Voucher ${result.voucher_number} saved and downloaded.`)
      router.refresh()
    } catch (err) {
      console.error('[PDF] save error:', err)
      toast.error(err instanceof Error ? err.message : 'Could not save voucher.')
    } finally {
      setIsDownloading(false)
    }
  }, [data, generateVoucherPdfBytes, router])

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

  return (
    <div className="space-y-6">
    <div className="flex flex-col xl:flex-row gap-6">

      {/* ── LEFT: Form ──────────────────────────────────────────────────────── */}
      <div className="hvf-form xl:w-[46%] shrink-0 space-y-4">

        {/* Voucher Info */}
        <Section title="Voucher Information">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Voucher No</Label>
              <Input placeholder="1502" value={data.voucherNo}
                onChange={e => setField('voucherNo', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference No</Label>
              <Input placeholder="ATT-1502" value={data.referenceNo}
                onChange={e => setField('referenceNo', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={data.date}
                onChange={e => setField('date', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Family Head (Name)</Label>
              <Input placeholder="SHAKIL AHMAD" value={data.familyHead}
                onChange={e => setField('familyHead', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Package Info</Label>
              <Input placeholder="Room (30) Nights" value={data.packageInfo}
                onChange={e => setField('packageInfo', e.target.value)} className="h-8 text-sm" />
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
                    <Label className="text-xs">Passport No</Label>
                    <Input placeholder="AB1234567" value={p.passportNo}
                      onChange={e => updatePilgrim(p.id, { passportNo: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Visa Number</Label>
                    <Input placeholder="Visa No" value={p.visaNumber}
                      onChange={e => updatePilgrim(p.id, { visaNumber: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PNR</Label>
                    <Input placeholder="PNR" value={p.pnr}
                      onChange={e => updatePilgrim(p.id, { pnr: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
            {data.accommodations.map((a, i) => (
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
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Hotel Name</Label>
                    <Input placeholder="Hilton Makkah" value={a.hotelName}
                      onChange={e => updateAccommodation(a.id, { hotelName: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Confirmation No</Label>
                    <Input placeholder="CONF-001" value={a.confirmNo}
                      onChange={e => updateAccommodation(a.id, { confirmNo: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <select value={a.city}
                      onChange={e => updateAccommodation(a.id, { city: e.target.value })}
                      className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                      <option value="Makkah">Makkah</option>
                      <option value="Madina">Madina</option>
                      <option value="Jeddah">Jeddah</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Room Type</Label>
                    <Input placeholder="Double / Quad" value={a.roomType}
                      onChange={e => updateAccommodation(a.id, { roomType: e.target.value })}
                      className="h-7 text-xs" />
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
                  <div className="space-y-1">
                    <Label className="text-xs">Check In</Label>
                    <Input type="date" value={a.checkIn}
                      onChange={e => updateAccommodation(a.id, { checkIn: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Check Out</Label>
                    <Input type="date" value={a.checkOut}
                      onChange={e => updateAccommodation(a.id, { checkOut: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nights</Label>
                    <Input type="number" min="1" placeholder="7" value={a.nights}
                      onChange={e => updateAccommodation(a.id, { nights: e.target.value })}
                      className="h-7 text-xs" />
                  </div>
                </div>
              </div>
            ))}
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
              <Input placeholder="+966 12 000 0000" value={data.makkahHotelContact}
                onChange={e => setField('makkahHotelContact', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Madina Hotel Contact</Label>
              <Input placeholder="+966 14 000 0000" value={data.madinaHotelContact}
                onChange={e => setField('madinaHotelContact', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Check-In Time</Label>
              <Input type="time" value={data.checkInTime}
                onChange={e => setField('checkInTime', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Check-Out Time</Label>
              <Input type="time" value={data.checkOutTime}
                onChange={e => setField('checkOutTime', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </Section>

        <Section title="Branding">
          <p className="text-[10px] text-muted-foreground mb-2">
            Logo stays in your browser only until download — not uploaded or stored on the server. Shown on both voucher pages.
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
            </div>
          )}
        </Section>

        <Button
          type="button"
          onClick={handleSaveAndDownload}
          disabled={isDownloading}
          className="w-full gap-2 bg-navy hover:bg-navy/90 text-white h-10"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Saving PDF…' : 'Save & Download Voucher'}
        </Button>
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
            {isDownloading ? 'Saving PDF…' : 'Save & Download Voucher'}
          </Button>
        </div>

        {/* Preview */}
        <div className="border rounded-lg overflow-hidden bg-muted/20 shadow-sm">
          <ScaledPreview>
            {previewPage === 1
              ? <VoucherPage1 data={data} branding={branding} />
              : <VoucherPage2 urduLines={urduLines} urduFooter={urduFooter} branding={branding} />
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
          <VoucherPage1 ref={page1Ref} data={data} branding={branding} />
          <VoucherPage2 ref={page2Ref} urduLines={urduLines} urduFooter={urduFooter} branding={branding} />
        </div>
      </div>

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

    {savedVouchers.length > 0 && (
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saved Vouchers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {savedVouchers.map(v => (
              <div key={v.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50">
                <div>
                  <p className="text-sm font-semibold text-navy">{v.voucher_number}</p>
                  <p className="text-xs text-muted-foreground">{v.family_head} · {v.voucher_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  {v.storage_key ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStoredDownload(v)}
                      disabled={isDownloading}
                      className="h-7 text-xs gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No stored file</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </div>
  )
}
