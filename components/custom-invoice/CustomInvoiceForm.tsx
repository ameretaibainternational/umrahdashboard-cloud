'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Download, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CustomInvoiceTemplate from './CustomInvoiceTemplate'
import InvoiceAppearanceControls from './InvoiceAppearanceControls'
import { generateCustomInvoicePdfBytes } from '@/lib/generate-custom-invoice-pdf'
import {
  DEFAULT_CUSTOM_INVOICE_BACKGROUND,
  DEFAULT_INVOICE_TEXT_COLOR,
} from '@/lib/invoice-backgrounds'
import { createCustomInvoiceWithPdf, updateCustomInvoiceWithPdf } from '@/app/actions/custom-invoices'
import { upsertInvoiceService } from '@/app/actions/settings'
import { downloadPdfBytes, downloadStoredPdf } from '@/lib/storage-client'
import { uint8ToBase64 } from '@/lib/pdf-utils'
import { getNextInvoiceNumber, resolveInvoiceSettings } from '@/lib/invoice-defaults'
import { isPackageInvoice } from '@/lib/package-invoice'
import { BrandingSlider, BrandingResetButton } from '@/components/branding/BrandingSlider'
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
import type { InvoiceSettings, CustomInvoice, CustomInvoiceLineItem, InvoiceClient, InvoicePaymentMethod, InvoiceService } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// ─── Local line-item state (strings for inputs) ──────────────────────────────
interface LineItemDraft {
  id: string
  service: string
  use_pax_price: boolean
  pax_price: string
  pax_price_unit: string
  use_night_price: boolean  // mutually exclusive with use_pax_price
  night_price: string
  night_price_unit: string
  total_pax: string         // label = "Total Pax" or "Total Nights" depending on active mode
  total: string
  total_unit: string
  received: string
}

function newRow(id: string, defaultCurrency = 'PKR'): LineItemDraft {
  return {
    id, service: '',
    use_pax_price: false, pax_price: '', pax_price_unit: defaultCurrency,
    use_night_price: false, night_price: '', night_price_unit: defaultCurrency,
    total_pax: '1', total: '', total_unit: '', received: '0',
  }
}

function lineItemToDraft(item: CustomInvoiceLineItem, id: string): LineItemDraft {
  return {
    id,
    service: item.service,
    use_pax_price: item.pax_price != null,
    pax_price: item.pax_price != null ? String(item.pax_price) : '',
    pax_price_unit: item.pax_price_unit || 'PKR',
    use_night_price: item.night_price != null,
    night_price: item.night_price != null ? String(item.night_price) : '',
    night_price_unit: item.night_price_unit || 'PKR',
    total_pax: String(item.total_pax || 1),
    total: String(item.total),
    total_unit: item.total_unit || 'PKR',
    received: String(item.received),
  }
}

function findPaymentMethodId(methods: InvoicePaymentMethod[], bankName: string, accountNo: string): string {
  const match = methods.find(
    m => m.bank_name === bankName && m.account_number === accountNo,
  )
  return match?.id ?? ''
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toNum(s: string) { const n = parseFloat(s.replace(/,/g, '')); return isNaN(n) ? 0 : n }

// globalCurrency = locked invoice currency derived from first row with use_pax_price
function buildLineItem(d: LineItemDraft, globalCurrency: string | null): CustomInvoiceLineItem {
  const pax_price   = d.use_pax_price   && d.pax_price   !== '' ? toNum(d.pax_price)   : null
  const night_price = d.use_night_price && d.night_price !== '' ? toNum(d.night_price) : null
  const qty = toNum(d.total_pax) || 1  // total_pax doubles as total_nights in night mode

  const paxUnit   = d.use_pax_price   ? (globalCurrency ?? d.pax_price_unit)   : d.pax_price_unit
  const nightUnit = d.night_price_unit || 'PKR'

  let total: number
  if (d.total !== '') {
    total = toNum(d.total)
  } else if (pax_price != null) {
    total = pax_price * qty
  } else if (night_price != null) {
    total = night_price * qty
  } else {
    total = 0
  }

  return {
    service: d.service,
    pax_price,
    pax_price_unit: paxUnit,
    night_price,
    night_price_unit: nightUnit,
    total_pax: qty,
    total,
    total_unit: d.use_pax_price ? paxUnit : d.use_night_price ? nightUnit : d.total_unit,
    received: toNum(d.received),
  }
}

function buildInvoice(
  invoiceNumber: string,
  date: string,
  billedName: string,
  billedAddress: string,
  billedPhone: string,
  bankName: string,
  accountNo: string,
  terms: string,
  phone: string,
  email: string,
  location: string,
  rows: LineItemDraft[],
  globalCurrency: string | null,
): CustomInvoice {
  const items = rows.map(r => buildLineItem(r, globalCurrency))
  const total    = items.reduce((s, i) => s + i.total, 0)
  const received = items.reduce((s, i) => s + i.received, 0)
  return {
    id: '',
    invoice_number: invoiceNumber,
    invoice_date: date,
    billed_to_name: billedName,
    billed_to_address: billedAddress,
    billed_to_client_number: billedPhone,
    payment_bank_name: bankName,
    payment_account_number: accountNo,
    terms_text: terms,
    contact_phone: phone,
    contact_email: email,
    contact_location: location,
    line_items: items,
    total,
    received,
    remaining: total - received,
    created_at: '',
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read logo file'))
    reader.readAsDataURL(file)
  })
}

// ─── ScaledPreview ────────────────────────────────────────────────────────────
const PAGE_H = 842  // matches template page height

function ScaledPreview({ children, totalPages }: { children: React.ReactNode; totalPages: number }) {
  const CANVAS_W = 595.5
  const MAX_W = 490
  const GAP = 8
  const totalCanvasH = PAGE_H * totalPages + GAP * (totalPages - 1)

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
    <div ref={outerRef} style={{ width: '100%', maxWidth: MAX_W }}>
      <div style={{ width: containerW, height: scaledH, overflow: 'hidden', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CANVAS_W, height: totalCanvasH }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  settings: InvoiceSettings
  existingInvoices: CustomInvoice[]
  savedClients: InvoiceClient[]
  paymentMethods: InvoicePaymentMethod[]
  services: InvoiceService[]
  editInvoice?: CustomInvoice | null
}

function applyClientToBilled(client: InvoiceClient) {
  return {
    name: client.name,
    address: client.address,
    phone: client.client_number,
  }
}

export default function CustomInvoiceForm({
  settings,
  existingInvoices,
  savedClients,
  paymentMethods,
  services,
  editInvoice = null,
}: Props) {
  const router = useRouter()
  const formId = useId()
  const isEditMode = !!editInvoice
  const today = new Date().toISOString().split('T')[0]
  const savedInvoices = existingInvoices.filter(inv => !inv.file_deleted_at && !isPackageInvoice(inv))
  const resolvedSettings = resolveInvoiceSettings(settings)
  const hasSavedClients = savedClients.length > 0
  const editClientMatch = editInvoice
    ? savedClients.find(c => c.name === editInvoice.billed_to_name)
    : null
  const initialClient = editClientMatch ?? (hasSavedClients ? savedClients[0] : null)
  const initialBilled = editInvoice
    ? {
        name: editInvoice.billed_to_name,
        address: editInvoice.billed_to_address,
        phone: editInvoice.billed_to_client_number,
      }
    : initialClient
      ? applyClientToBilled(initialClient)
      : { name: '', address: '', phone: '' }

  const applyDefaultFields = useCallback((source: InvoiceSettings) => {
    setBankName(source.payment_bank_name)
    setAccountNo(source.payment_account_number)
    setTerms(source.terms_text)
    setPhone(source.contact_phone)
    setEmail(source.contact_email)
    setLocation(source.contact_location)
  }, [])

  const resetForNewInvoice = useCallback((
    invoices: CustomInvoice[],
    source: InvoiceSettings,
    clients: InvoiceClient[],
  ) => {
    const first = clients[0]
    if (first) {
      const billed = applyClientToBilled(first)
      setSelectedClientId(first.id)
      setIsNewCustomer(false)
      setBilledName(billed.name)
      setBilledAddr(billed.address)
      setBilledPhone(billed.phone)
    } else {
      setSelectedClientId('')
      setIsNewCustomer(true)
      setBilledName('')
      setBilledAddr('')
      setBilledPhone('')
    }
    applyDefaultFields(source)
    setRows([newRow(`${formId}-0`)])
    setDate(new Date().toISOString().split('T')[0])
    setInvoiceNumber(getNextInvoiceNumber(invoices))
    setInvoiceTitleText('INVOICE')
  }, [applyDefaultFields, formId])

  // Form state
  const [editingId, setEditingId] = useState(editInvoice?.id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(() => editInvoice?.invoice_number ?? getNextInvoiceNumber(existingInvoices))
  const [invoiceTitleText, setInvoiceTitleText] = useState(() => editInvoice?.invoice_title_text?.trim() || 'INVOICE')
  const [date, setDate]             = useState(editInvoice?.invoice_date ?? today)
  const [selectedClientId, setSelectedClientId] = useState(initialClient?.id ?? '')
  const [isNewCustomer, setIsNewCustomer] = useState(editInvoice ? !editClientMatch : !hasSavedClients)
  const [billedName, setBilledName] = useState(initialBilled.name)
  const [billedAddr, setBilledAddr] = useState(initialBilled.address)
  const [billedPhone, setBilledPhone] = useState(initialBilled.phone)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(() =>
    editInvoice
      ? findPaymentMethodId(paymentMethods, editInvoice.payment_bank_name, editInvoice.payment_account_number)
      : paymentMethods[0]?.id ?? '',
  )
  const [bankName, setBankName]     = useState(editInvoice?.payment_bank_name ?? resolvedSettings.payment_bank_name)
  const [accountNo, setAccountNo]   = useState(editInvoice?.payment_account_number ?? resolvedSettings.payment_account_number)
  const [terms, setTerms]           = useState(editInvoice?.terms_text ?? resolvedSettings.terms_text)
  const [phone, setPhone]           = useState(editInvoice?.contact_phone ?? resolvedSettings.contact_phone)
  const [email, setEmail]           = useState(editInvoice?.contact_email ?? resolvedSettings.contact_email)
  const [location, setLocation]     = useState(editInvoice?.contact_location ?? resolvedSettings.contact_location)
  const [rows, setRows]             = useState<LineItemDraft[]>(() =>
    editInvoice?.line_items?.length
      ? editInvoice.line_items.map((item, i) => lineItemToDraft(item, `${formId}-${i}`))
      : [newRow(`${formId}-0`)],
  )
  const [showForm, setShowForm]     = useState(true)
  const [newServiceRowId, setNewServiceRowId] = useState<string | null>(null)
  const [newServiceName, setNewServiceName] = useState('')
  const [isSavingService, setIsSavingService] = useState(false)
  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [logoSize, setLogoSize]     = useState(DEFAULT_LOGO_SIZE)
  const [logoX, setLogoX]           = useState(DEFAULT_LOGO_X)
  const [logoY, setLogoY]           = useState(DEFAULT_LOGO_Y)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [signaturePersonName, setSignaturePersonName] = useState('')
  const [invoiceBackground, setInvoiceBackground] = useState(DEFAULT_CUSTOM_INVOICE_BACKGROUND)
  const [invoiceTextColor, setInvoiceTextColor] = useState(DEFAULT_INVOICE_TEXT_COLOR)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const logoBox = getLogoBoxSize(logoSize)
  const logoMaxX = Math.max(0, INTRINSIC_BG_W - logoBox.w)
  const logoMaxY = Math.max(0, INTRINSIC_BG_H - logoBox.h)

  const branding: InvoiceBranding = {
    logoUrl,
    logoX,
    logoY,
    logoSize,
    signatureUrl,
    signaturePersonName: signaturePersonName.trim() || undefined,
  }

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

  useEffect(() => {
    return () => {
      if (signatureUrl) URL.revokeObjectURL(signatureUrl)
    }
  }, [signatureUrl])

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

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (signatureUrl) URL.revokeObjectURL(signatureUrl)
    setSignatureUrl(URL.createObjectURL(file))
  }

  function clearLogo() {
    setLogoUrl(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  function clearSignature() {
    if (signatureUrl) URL.revokeObjectURL(signatureUrl)
    setSignatureUrl(null)
    if (signatureInputRef.current) signatureInputRef.current.value = ''
  }

  function handlePaymentMethodSelect(id: string) {
    setSelectedPaymentMethodId(id)
    const method = paymentMethods.find(m => m.id === id)
    if (!method) return
    setBankName(method.bank_name)
    setAccountNo(method.account_number)
  }

  async function handleSaveNewService() {
    const name = newServiceName.trim()
    if (!name) {
      toast.error('Service name is required.')
      return
    }
    setIsSavingService(true)
    try {
      const fd = new FormData()
      fd.set('name', name)
      const result = await upsertInvoiceService(fd)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if (newServiceRowId) {
        updateRow(newServiceRowId, { service: name })
      }
      toast.success('Service saved!')
      setNewServiceRowId(null)
      setNewServiceName('')
      router.refresh()
    } finally {
      setIsSavingService(false)
    }
  }

  function handleClientSelect(id: string) {
    setSelectedClientId(id)
    const client = savedClients.find(c => c.id === id)
    if (!client) return
    const billed = applyClientToBilled(client)
    setBilledName(billed.name)
    setBilledAddr(billed.address)
    setBilledPhone(billed.phone)
  }

  function handleNewCustomerChange(checked: boolean) {
    setIsNewCustomer(checked)
    if (!checked && hasSavedClients) {
      const client = savedClients.find(c => c.id === selectedClientId) ?? savedClients[0]
      handleClientSelect(client.id)
      return
    }
    if (checked) {
      setBilledName('')
      setBilledAddr('')
      setBilledPhone('')
    }
  }

  useEffect(() => {
    if (isNewCustomer || savedClients.length === 0) return
    const client = savedClients.find(c => c.id === selectedClientId) ?? savedClients[0]
    if (!client) return
    const billed = applyClientToBilled(client)
    if (client.id !== selectedClientId) setSelectedClientId(client.id)
    setBilledName(billed.name)
    setBilledAddr(billed.address)
    setBilledPhone(billed.phone)
  }, [savedClients, isNewCustomer, selectedClientId])

  useEffect(() => {
    if (editInvoice?.id) setEditingId(editInvoice.id)
  }, [editInvoice?.id])

  useEffect(() => {
    if (isEditMode) return
    applyDefaultFields(resolveInvoiceSettings(settings))
  }, [settings, applyDefaultFields, isEditMode])

  useEffect(() => {
    if (isEditMode) return
    setInvoiceNumber(getNextInvoiceNumber(existingInvoices))
  }, [existingInvoices, isEditMode])

  const printRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  // captureInvoice: when set, the hidden template renders this instead of previewInvoice
  // (used for saved-invoice downloads so we can capture a different invoice)
  const [captureInvoice, setCaptureInvoice] = useState<CustomInvoice | null>(null)

  // Currency lock: if the first row has use_pax_price checked, its currency applies to all rows
  const lockedCurrency = rows[0]?.use_pax_price ? (rows[0].pax_price_unit || 'PKR') : null

  // Total pages for live preview (mirrors template split logic)
  const previewTotalPages = rows.length <= 5
    ? 1
    : 1 + Math.ceil((rows.length - 5) / 9)

  // Live invoice preview — reflects form state in real-time
  const previewInvoice = buildInvoice(
    invoiceNumber || 'ATI-001',
    date,
    billedName || 'Client Name',
    billedAddr || 'Address',
    billedPhone || '—',
    bankName,
    accountNo,
    terms,
    phone,
    email,
    location,
    rows,
    lockedCurrency,
  )

  // The hidden template always renders either the live preview or a saved invoice.
  // Key: NEVER conditionally unmount this template — html2canvas needs it already
  // in the DOM before we call it. Also: no opacity:0 or visibility:hidden on the
  // wrapper (html2canvas respects those and produces a blank/transparent canvas).
  // Instead we rely on z-index:-9999 + pointer-events:none to keep it invisible.
  const hiddenInvoice = captureInvoice ?? previewInvoice

  // Generate PDF bytes from the hidden template (same pipeline as before).
  const generateInvoicePdfBytes = useCallback(async (inv: CustomInvoice, isSaved = false): Promise<Uint8Array> => {
    if (isSaved) {
      setCaptureInvoice(inv)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    }

    try {
      const wrapper = printRef.current
      if (!wrapper) throw new Error('Template ref not ready')
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      return generateCustomInvoicePdfBytes(wrapper, branding, invoiceBackground)
    } finally {
      if (isSaved) setCaptureInvoice(null)
    }
  }, [branding, invoiceBackground])

  const handleSaveAndDownload = useCallback(async () => {
    if (!billedName.trim()) {
      toast.error('Client name is required.')
      return
    }
    setIsDownloading(true)
    try {
      const inv = buildInvoice(
        invoiceNumber || 'ATI-001',
        date,
        billedName,
        billedAddr,
        billedPhone,
        bankName,
        accountNo,
        terms,
        phone,
        email,
        location,
        rows,
        lockedCurrency,
      )
      const bytes = await generateInvoicePdfBytes(inv, false)
      const payload = {
        invoice_date: inv.invoice_date,
        billed_to_name: inv.billed_to_name,
        billed_to_address: inv.billed_to_address,
        billed_to_client_number: inv.billed_to_client_number,
        payment_bank_name: inv.payment_bank_name,
        payment_account_number: inv.payment_account_number,
        terms_text: inv.terms_text,
        contact_phone: inv.contact_phone,
        contact_email: inv.contact_email,
        contact_location: inv.contact_location,
        line_items: inv.line_items,
        total: inv.total,
        received: inv.received,
        remaining: inv.remaining,
        pdf_base64: uint8ToBase64(bytes),
        invoice_number: invoiceNumber || inv.invoice_number,
        invoice_title_text: invoiceTitleText.trim() || 'INVOICE',
      }

      const updateId = editInvoice?.id ?? editingId
      const result = updateId
        ? await updateCustomInvoiceWithPdf({ ...payload, id: updateId, invoice_number: invoiceNumber || inv.invoice_number })
        : await createCustomInvoiceWithPdf(payload)

      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if (!('success' in result) || !result.success) return
      downloadPdfBytes(bytes, `${result.invoice_number}.pdf`)
      if (updateId) {
        toast.success(`Invoice ${result.invoice_number} updated, booking synced, and downloaded.`)
        router.push('/custom-invoices')
      } else {
        toast.success(`Invoice ${result.invoice_number} saved, booking created, and downloaded.`)
        resetForNewInvoice(
          [...existingInvoices, { invoice_number: result.invoice_number } as CustomInvoice],
          resolveInvoiceSettings(settings),
          savedClients,
        )
      }
      router.refresh()
    } catch (err) {
      console.error('[PDF] save error:', err)
      toast.error(err instanceof Error ? err.message : 'Could not save invoice.')
    } finally {
      setIsDownloading(false)
    }
  }, [
    billedName, invoiceNumber, invoiceTitleText, date, billedAddr, billedPhone, bankName, accountNo,
    terms, phone, email, location, rows, lockedCurrency, generateInvoicePdfBytes, router,
    existingInvoices, settings, resetForNewInvoice, savedClients, editInvoice, editingId,
  ])

  async function handleStoredDownload(inv: CustomInvoice) {
    if (inv.file_deleted_at) {
      toast.error(`File removed — storage was freed on ${inv.file_deleted_at.split('T')[0]}.`)
      return
    }
    if (!inv.storage_key) {
      toast.error('No stored PDF for this invoice.')
      return
    }
    setIsDownloading(true)
    try {
      await downloadStoredPdf(inv.id, 'invoice')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setIsDownloading(false)
    }
  }

  function updateRow(id: string, patch: Partial<LineItemDraft>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function addRow() { setRows(prev => [...prev, newRow(`${formId}-${prev.length}`, lockedCurrency ?? 'PKR')]) }
  function removeRow(id: string) { setRows(prev => prev.filter(r => r.id !== id)) }

  function handleDownload() { void handleSaveAndDownload() }

  return (
    <div className="space-y-6">
      {/* ── New Invoice ──────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowForm(v => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{isEditMode ? `Edit Invoice ${invoiceNumber}` : 'New Custom Invoice'}</CardTitle>
            {showForm ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showForm && (
          <CardContent>
            <div className="flex gap-6 flex-wrap xl:flex-nowrap">
              {/* ── LEFT: form — capped at ~45% so the preview gets more room ── */}
              <div className="flex-1 min-w-0 max-w-[580px] space-y-5">

                {/* Invoice Number + Date */}
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Number</Label>
                    <Input
                      placeholder="ATI-001"
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      className="h-9 w-36"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Title</Label>
                    <Input
                      placeholder="INVOICE"
                      value={invoiceTitleText}
                      onChange={e => setInvoiceTitleText(e.target.value)}
                      className="h-9 w-48"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice Date</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-48" />
                  </div>
                </div>

                {/* Billed To */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Billed To</p>

                  {hasSavedClients && (
                    <div className="space-y-3 mb-3">
                      {!isNewCustomer && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Saved Client</Label>
                          <select
                            value={selectedClientId}
                            onChange={e => handleClientSelect(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {savedClients.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`${formId}-new-customer`}
                          checked={isNewCustomer}
                          onChange={e => handleNewCustomerChange(e.target.checked)}
                          className="w-3.5 h-3.5 accent-navy"
                        />
                        <Label htmlFor={`${formId}-new-customer`} className="text-xs cursor-pointer">New customer</Label>
                      </div>
                    </div>
                  )}

                  {(isNewCustomer || !hasSavedClients) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Name *</Label>
                        <Input placeholder="ATIQ TRAVEL & TOURS" value={billedName} onChange={e => setBilledName(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Address</Label>
                        <Input placeholder="DUBAI" value={billedAddr} onChange={e => setBilledAddr(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Client Number</Label>
                        <Input placeholder="+971 50 000 0000" value={billedPhone} onChange={e => setBilledPhone(e.target.value)} className="h-9" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Payment Method</p>
                  {paymentMethods.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <Label className="text-xs">Saved Payment Method</Label>
                      <select
                        value={selectedPaymentMethodId}
                        onChange={e => handlePaymentMethodSelect(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Custom / manual</option>
                        {paymentMethods.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bank Name</Label>
                      <Input placeholder="Meezan Bank" value={bankName} onChange={e => setBankName(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Account Number</Label>
                      <Input placeholder="01234567890123" value={accountNo} onChange={e => setAccountNo(e.target.value)} className="h-9" />
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-navy uppercase tracking-wide">Line Items</p>
                    <Button type="button" size="sm" variant="outline" onClick={addRow} className="h-7 text-xs gap-1 border-navy text-white bg-navy hover:text-navy">
                      <Plus className="w-3 h-3" /> Add Row
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {rows.map((row, idx) => {
                      // The effective currency for this row: locked by row 0 if it has use_pax_price, else own
                      const isFirstPaxRow = idx === 0
                      const rowCurrency = lockedCurrency && !isFirstPaxRow ? lockedCurrency : (row.pax_price_unit || 'PKR')
                      const currencyLocked = !!lockedCurrency && !isFirstPaxRow

                      return (
                        <div key={row.id} className="border rounded-lg p-3 space-y-3 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Row {idx + 1}</span>
                            {rows.length > 1 && (
                              <button type="button" onClick={() => removeRow(row.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Service */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">Service</Label>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              {services.length > 0 && (
                                <select
                                  value={services.some(s => s.name === row.service) ? row.service : ''}
                                  onChange={e => {
                                    if (e.target.value) updateRow(row.id, { service: e.target.value })
                                  }}
                                  className="h-9 w-full sm:w-auto sm:min-w-[140px] sm:max-w-[11rem] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  <option value="">Select service…</option>
                                  {services.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                  ))}
                                </select>
                              )}
                              <Input
                                placeholder="e.g. 03 MONTH UMRAH VISA"
                                value={row.service}
                                onChange={e => updateRow(row.id, { service: e.target.value })}
                                className="h-9 w-full sm:flex-1 min-w-0"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 text-xs w-full sm:w-auto shrink-0"
                                onClick={() => {
                                  setNewServiceRowId(row.id)
                                  setNewServiceName(row.service)
                                }}
                              >
                                New service
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 items-end">
                            {/* Pax price + Per Night price — mutually exclusive toggles */}
                            <div className="space-y-2 shrink-0">

                              {/* 1 Pax Price */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`pax-${row.id}`}
                                    checked={row.use_pax_price}
                                    onChange={e => {
                                      updateRow(row.id, {
                                        use_pax_price: e.target.checked,
                                        use_night_price: false,  // uncheck the other
                                        pax_price_unit: e.target.checked ? rowCurrency : row.pax_price_unit,
                                        total: '',
                                      })
                                    }}
                                    className="w-3.5 h-3.5 accent-navy"
                                  />
                                  <Label htmlFor={`pax-${row.id}`} className="text-xs cursor-pointer">1 Pax Price</Label>
                                </div>
                                {row.use_pax_price && (
                                  <div className="flex gap-1">
                                    <Input
                                      placeholder="6500"
                                      value={row.pax_price}
                                      onChange={e => {
                                        const val = e.target.value
                                        const newTotal = toNum(val) * (toNum(row.total_pax) || 1)
                                        updateRow(row.id, { pax_price: val, total: newTotal > 0 ? String(newTotal) : '' })
                                      }}
                                      className="h-8 text-sm w-24"
                                    />
                                    <select
                                      value={rowCurrency}
                                      disabled={currencyLocked}
                                      onChange={e => updateRow(row.id, { pax_price_unit: e.target.value })}
                                      className="h-8 text-sm rounded-md border border-input bg-background px-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <option value="PKR">PKR</option>
                                      <option value="SAR">SAR</option>
                                    </select>
                                  </div>
                                )}
                              </div>

                              {/* Per Night Price */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`night-${row.id}`}
                                    checked={row.use_night_price}
                                    onChange={e => {
                                      updateRow(row.id, {
                                        use_night_price: e.target.checked,
                                        use_pax_price: false,  // uncheck the other
                                        total: '',
                                      })
                                    }}
                                    className="w-3.5 h-3.5 accent-navy"
                                  />
                                  <Label htmlFor={`night-${row.id}`} className="text-xs cursor-pointer">Per Night Price</Label>
                                </div>
                                {row.use_night_price && (
                                  <div className="flex gap-1">
                                    <Input
                                      placeholder="5000"
                                      value={row.night_price}
                                      onChange={e => {
                                        const val = e.target.value
                                        const newTotal = toNum(val) * (toNum(row.total_pax) || 1)
                                        updateRow(row.id, { night_price: val, total: newTotal > 0 ? String(newTotal) : '' })
                                      }}
                                      className="h-8 text-sm w-24"
                                    />
                                    <select
                                      value={row.night_price_unit || 'PKR'}
                                      onChange={e => updateRow(row.id, { night_price_unit: e.target.value })}
                                      className="h-8 text-sm rounded-md border border-input bg-background px-2"
                                    >
                                      <option value="PKR">PKR</option>
                                      <option value="SAR">SAR</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Total Pax / Total Nights — label changes with active mode */}
                            <div className="space-y-1.5 w-full sm:w-[80px] shrink-0">
                              <Label className="text-xs">
                                {row.use_night_price ? 'Total Nights' : 'Total Pax'}
                              </Label>
                              <Input
                                type="number" min="1"
                                value={row.total_pax}
                                onChange={e => {
                                  const val = e.target.value
                                  const qty = toNum(val) || 1
                                  if (row.use_pax_price && row.pax_price) {
                                    updateRow(row.id, { total_pax: val, total: String(toNum(row.pax_price) * qty) })
                                  } else if (row.use_night_price && row.night_price) {
                                    updateRow(row.id, { total_pax: val, total: String(toNum(row.night_price) * qty) })
                                  } else {
                                    updateRow(row.id, { total_pax: val })
                                  }
                                }}
                                className="h-8 text-sm"
                              />
                            </div>

                            {/* Total — no currency field when pax price is active (inherited automatically) */}
                            <div className="space-y-1.5 w-full sm:w-[150px] shrink-0">
                              <Label className="text-xs">Total</Label>
                              <div className="flex gap-1 items-center">
                                <Input
                                  placeholder={row.use_pax_price && row.pax_price ? String(toNum(row.pax_price) * (toNum(row.total_pax) || 1)) : '798000'}
                                  value={row.total}
                                  onChange={e => updateRow(row.id, { total: e.target.value })}
                                  className="h-8 text-sm"
                                />
                                {row.use_pax_price ? (
                                  // Currency is auto-derived — show as static label
                                  <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{rowCurrency}</span>
                                ) : (
                                  <select
                                    value={row.total_unit || 'PKR'}
                                    onChange={e => updateRow(row.id, { total_unit: e.target.value })}
                                    className="h-8 text-sm rounded-md border border-input bg-background px-2"
                                  >
                                    <option value="PKR">PKR</option>
                                    <option value="SAR">SAR</option>
                                  </select>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Received */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">Received</Label>
                            <Input
                              type="number" min="0"
                              value={row.received}
                              onChange={e => updateRow(row.id, { received: e.target.value })}
                              className="h-8 text-sm w-full sm:w-40"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Invoice appearance (client-side only — not saved to server) */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Invoice Appearance</p>
                  <InvoiceAppearanceControls
                    backgroundSrc={invoiceBackground}
                    onBackgroundChange={setInvoiceBackground}
                    textColor={invoiceTextColor}
                    onTextColorChange={setInvoiceTextColor}
                    defaultBackground={DEFAULT_CUSTOM_INVOICE_BACKGROUND}
                  />
                </div>

                {/* Branding (client-side only — not saved to server) */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-1 uppercase tracking-wide">Branding</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Logo and signature stay in your browser only until you download. They are not uploaded or stored on the server.
                  </p>
                  <div className="space-y-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Signature Name</Label>
                        <Input
                          placeholder="Authorized Signatory"
                          value={signaturePersonName}
                          onChange={e => setSignaturePersonName(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Signature Upload (PNG)</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            ref={signatureInputRef}
                            type="file"
                            accept="image/png"
                            onChange={handleSignatureUpload}
                            className="h-9 text-xs cursor-pointer"
                          />
                          {signatureUrl && (
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={clearSignature}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Terms and Condition</Label>
                  <textarea
                    value={terms}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTerms(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>

                {/* Contact */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Contact Us</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone</Label>
                      <Input placeholder="+92 300 0000000" value={phone} onChange={e => setPhone(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" placeholder="info@example.pk" value={email} onChange={e => setEmail(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Location</Label>
                      <Input placeholder="Lahore, Pakistan" value={location} onChange={e => setLocation(e.target.value)} className="h-9" />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="bg-navy hover:bg-navy-2 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isDownloading ? 'Saving PDF…' : isEditMode ? 'Update & Download Invoice' : 'Save & Download Invoice'}
                  </Button>
                </div>
              </div>

              {/* ── RIGHT: live preview ──────────────────────────── */}
              <div className="min-w-0 w-full xl:flex-1">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Live Preview {previewTotalPages > 1 && <span className="text-muted-foreground/60">({previewTotalPages} pages)</span>}
                </p>
                <ScaledPreview totalPages={previewTotalPages}>
                  <CustomInvoiceTemplate
                    invoice={previewInvoice}
                    branding={branding}
                    titleText={invoiceTitleText.trim() || 'INVOICE'}
                    backgroundImage={invoiceBackground}
                    textColor={invoiceTextColor}
                  />
                </ScaledPreview>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Invoice List ─────────────────────────────────────────────── */}
      {savedInvoices.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saved Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {savedInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-navy">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.billed_to_name} · {inv.invoice_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/custom-invoices?edit=${inv.id}`}
                      className="inline-flex items-center justify-center gap-1 h-7 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Link>
                    {inv.storage_key ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStoredDownload(inv)}
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

      <Dialog open={!!newServiceRowId} onOpenChange={open => { if (!open) { setNewServiceRowId(null); setNewServiceName('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Service Name *</Label>
              <Input
                value={newServiceName}
                onChange={e => setNewServiceName(e.target.value)}
                placeholder="03 MONTH UMRAH VISA"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewServiceRowId(null); setNewServiceName('') }}>Cancel</Button>
              <Button type="button" disabled={isSavingService} className="bg-navy hover:bg-navy-2 text-white" onClick={() => void handleSaveNewService()}>
                {isSavingService ? 'Saving…' : 'Save Service'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/*
        ── Hidden capture target ─────────────────────────────────────────
        Always rendered (never conditionally unmounted) so printRef is
        always valid when the download button is clicked.
        Positioned at top:0 left:0 behind all content — NO opacity/visibility
        tricks because html2canvas honours those and produces a blank canvas.
      */}
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none' }}>
        <CustomInvoiceTemplate
          ref={printRef}
          invoice={hiddenInvoice}
          branding={branding}
          titleText={invoiceTitleText.trim() || 'INVOICE'}
          backgroundImage={invoiceBackground}
          textColor={invoiceTextColor}
        />
      </div>
    </div>
  )
}
