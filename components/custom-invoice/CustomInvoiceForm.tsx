'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CustomInvoiceTemplate from './CustomInvoiceTemplate'
import type { InvoiceSettings, CustomInvoice, CustomInvoiceLineItem } from '@/lib/types'

// ─── Local line-item state (strings for inputs) ──────────────────────────────
interface LineItemDraft {
  id: string
  service: string
  use_pax_price: boolean
  pax_price: string
  pax_price_unit: string
  total_pax: string
  total: string
  total_unit: string
  received: string
}

function newRow(id: string, defaultCurrency = 'PKR'): LineItemDraft {
  return { id, service: '', use_pax_price: false, pax_price: '', pax_price_unit: defaultCurrency, total_pax: '1', total: '', total_unit: '', received: '0' }
}

let _id = 0
const uid = () => String(++_id)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toNum(s: string) { const n = parseFloat(s.replace(/,/g, '')); return isNaN(n) ? 0 : n }

// globalCurrency = locked invoice currency derived from first row with use_pax_price
function buildLineItem(d: LineItemDraft, globalCurrency: string | null): CustomInvoiceLineItem {
  const pax_price = d.use_pax_price && d.pax_price !== '' ? toNum(d.pax_price) : null
  const total_pax = toNum(d.total_pax) || 1
  const total = d.total !== '' ? toNum(d.total) : (pax_price != null ? pax_price * total_pax : 0)
  // When pax price is used, currency is always the global (or row's own) currency
  const paxUnit = d.use_pax_price ? (globalCurrency ?? d.pax_price_unit) : d.pax_price_unit
  return {
    service: d.service,
    pax_price,
    pax_price_unit: paxUnit,
    total_pax,
    total,
    // Inherit currency from pax price when checkbox is active; otherwise use manual input
    total_unit: d.use_pax_price ? paxUnit : d.total_unit,
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
  settings: InvoiceSettings | null
  existingInvoices: CustomInvoice[]
}

export default function CustomInvoiceForm({ settings, existingInvoices }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('ATI-001')
  const [date, setDate]             = useState(today)
  const [billedName, setBilledName] = useState('')
  const [billedAddr, setBilledAddr] = useState('')
  const [billedPhone, setBilledPhone] = useState('')
  const [bankName, setBankName]     = useState(settings?.payment_bank_name ?? '')
  const [accountNo, setAccountNo]   = useState(settings?.payment_account_number ?? '')
  const [terms, setTerms]           = useState(settings?.terms_text ?? '')
  const [phone, setPhone]           = useState(settings?.contact_phone ?? '')
  const [email, setEmail]           = useState(settings?.contact_email ?? '')
  const [location, setLocation]     = useState(settings?.contact_location ?? '')
  const [rows, setRows]             = useState<LineItemDraft[]>([newRow(uid())])
  const [showForm, setShowForm]     = useState(true)

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

  // html2canvas + jsPDF — real PDF, direct download, no browser print dialog.
  const downloadAsPdf = useCallback(async (inv: CustomInvoice, isSaved = false) => {
    setIsDownloading(true)

    // For saved invoices we need to switch the hidden template content first.
    if (isSaved) {
      setCaptureInvoice(inv)
      // Give React two animation frames to commit the new render
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    }

    try {
      const wrapper = printRef.current
      if (!wrapper) throw new Error('Template ref not ready')

      const pages = Array.from(wrapper.querySelectorAll('[data-invoice-root]')) as HTMLElement[]
      if (pages.length === 0) throw new Error('No invoice pages found')

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#121117',
          logging: false,
          imageTimeout: 30000,
          // Prevent html2canvas from using the scrolled position of the window
          scrollX: 0,
          scrollY: 0,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297)
      }

      const filename = (inv.invoice_number || 'invoice').replace(/[^a-zA-Z0-9-_]/g, '-')
      pdf.save(`${filename}.pdf`)
    } catch (err) {
      console.error('[PDF] generation error:', err)
      alert(`PDF could not be generated: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsDownloading(false)
      if (isSaved) setCaptureInvoice(null)
    }
  }, [])

  function updateRow(id: string, patch: Partial<LineItemDraft>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function addRow() { setRows(prev => [...prev, newRow(uid(), lockedCurrency ?? 'PKR')]) }
  function removeRow(id: string) { setRows(prev => prev.filter(r => r.id !== id)) }

  function handleDownload() { downloadAsPdf(previewInvoice, false) }
  function handlePrintCurrent(inv: CustomInvoice) { downloadAsPdf(inv, true) }

  return (
    <div className="space-y-6">
      {/* ── New Invoice ──────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowForm(v => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">New Custom Invoice</CardTitle>
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
                    <Label className="text-xs">Invoice Date</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-48" />
                  </div>
                </div>

                {/* Billed To */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Billed To</p>
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
                </div>

                {/* Payment Method */}
                <div>
                  <p className="text-xs font-semibold text-navy mb-2 uppercase tracking-wide">Payment Method</p>
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
                            <Input
                              placeholder="e.g. 03 MONTH UMRAH VISA"
                              value={row.service}
                              onChange={e => updateRow(row.id, { service: e.target.value })}
                              className="h-9"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3 items-end">
                            {/* Pax toggle + price */}
                            <div className="space-y-1.5 w-[190px] shrink-0">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`pax-${row.id}`}
                                  checked={row.use_pax_price}
                                  onChange={e => {
                                    // When enabling pax price, inherit locked currency if applicable
                                    updateRow(row.id, {
                                      use_pax_price: e.target.checked,
                                      pax_price_unit: e.target.checked ? rowCurrency : row.pax_price_unit,
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
                                    className="h-8 text-sm w-26"
                                  />
                                  {/* SAR / PKR dropdown — disabled for non-first rows when currency is locked */}
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

                            {/* Total Pax */}
                            <div className="space-y-1.5 w-[80px] shrink-0">
                              <Label className="text-xs">Total Pax</Label>
                              <Input
                                type="number" min="1"
                                value={row.total_pax}
                                onChange={e => {
                                  const val = e.target.value
                                  if (row.use_pax_price && row.pax_price) {
                                    const newTotal = toNum(row.pax_price) * (toNum(val) || 1)
                                    updateRow(row.id, { total_pax: val, total: String(newTotal) })
                                  } else {
                                    updateRow(row.id, { total_pax: val })
                                  }
                                }}
                                className="h-8 text-sm"
                              />
                            </div>

                            {/* Total — no currency field when pax price is active (inherited automatically) */}
                            <div className="space-y-1.5 w-[150px] shrink-0">
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
                              className="h-8 text-sm w-40"
                            />
                          </div>
                        </div>
                      )
                    })}
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
                    {isDownloading ? 'Generating PDF…' : 'Download Invoice'}
                  </Button>
                </div>
              </div>

              {/* ── RIGHT: live preview ──────────────────────────── */}
              <div className="min-w-0 w-full xl:flex-1">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Live Preview {previewTotalPages > 1 && <span className="text-muted-foreground/60">({previewTotalPages} pages)</span>}
                </p>
                <ScaledPreview totalPages={previewTotalPages}>
                  <CustomInvoiceTemplate invoice={previewInvoice} />
                </ScaledPreview>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Invoice List ─────────────────────────────────────────────── */}
      {existingInvoices.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saved Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {existingInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-navy">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.billed_to_name} · {inv.invoice_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {new Intl.NumberFormat('en-US').format(inv.total)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintCurrent(inv)}
                      className="h-7 text-xs gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        ── Hidden capture target ─────────────────────────────────────────
        Always rendered (never conditionally unmounted) so printRef is
        always valid when the download button is clicked.
        Positioned at top:0 left:0 behind all content — NO opacity/visibility
        tricks because html2canvas honours those and produces a blank canvas.
      */}
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none' }}>
        <CustomInvoiceTemplate ref={printRef} invoice={hiddenInvoice} />
      </div>
    </div>
  )
}
