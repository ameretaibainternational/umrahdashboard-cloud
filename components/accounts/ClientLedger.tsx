'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteLedgerEntries } from '@/app/actions/accounts'
import type { Payment, Booking } from '@/lib/types'
import { pkr, formatDate, bookingInvoiceId, sar } from '@/lib/formatters'
import { formatLedgerInvoices, ledgerCustomerKey, ledgerDisplayName } from '@/lib/ledger-utils'
import { staffUsernames } from '@/lib/staff-lookup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, Printer, Copy, Trash2, Loader2 } from 'lucide-react'

interface Props {
  payments: Payment[]
  bookings: Booking[]
  companyName: string
  sarToPkrRate?: number
  staffUsernames?: Record<string, string>
}

interface LedgerRow {
  customerKey: string
  customerName: string
  bookingIds: string[]
  paymentDate: string
  invoiceIds: string[]
  packageAmount: number
  receivedAmount: number
  balance: number
  method: string
  note: string
  recordedByIds: string[]
}

interface BookingLedgerRow {
  bookingId: string
  customerName: string
  paymentDate: string
  invoiceId: string
  packageAmount: number
  receivedAmount: number
  balance: number
  method: string
  note: string
  recordedByIds: string[]
}

function buildBookingLedgerRows(
  payments: Payment[],
  bookingMap: Map<string, Booking>,
): BookingLedgerRow[] {
  const byBooking = new Map<string, {
    receivedAmount: number
    latestPaymentDate: string
    latestMethod: string
    latestNote: string
    customerName: string
    recordedByIds: string[]
  }>()

  for (const p of payments) {
    const key = p.booking_id || ''
    let entry = byBooking.get(key)
    if (!entry) {
      entry = {
        receivedAmount: 0,
        latestPaymentDate: p.payment_date,
        latestMethod: p.method,
        latestNote: p.note || '',
        customerName: p.customer_name,
        recordedByIds: [],
      }
      byBooking.set(key, entry)
    }

    entry.receivedAmount += p.amount_pkr
    if (p.created_by && !entry.recordedByIds.includes(p.created_by)) {
      entry.recordedByIds.push(p.created_by)
    }

    if (p.payment_date.localeCompare(entry.latestPaymentDate) >= 0) {
      entry.latestPaymentDate = p.payment_date
      entry.latestMethod = p.method
      if (p.note?.trim()) entry.latestNote = p.note.trim()
    }
  }

  const rows: BookingLedgerRow[] = []

  for (const [bookingId, entry] of byBooking) {
    const booking = bookingMap.get(bookingId)

    rows.push({
      bookingId,
      customerName: booking?.customer_name ?? entry.customerName,
      paymentDate: entry.latestPaymentDate,
      invoiceId: booking ? bookingInvoiceId(booking) : bookingInvoiceId(bookingId),
      packageAmount: booking?.total_pkr ?? 0,
      receivedAmount: entry.receivedAmount,
      balance: booking?.remaining_pkr ?? 0,
      method: entry.latestMethod,
      note: entry.latestNote,
      recordedByIds: entry.recordedByIds,
    })
  }

  return rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
}

function aggregateCustomerLedgerRows(rows: BookingLedgerRow[]): LedgerRow[] {
  const byCustomer = new Map<string, LedgerRow>()

  for (const row of rows) {
    const customerKey = ledgerCustomerKey(row.customerName)
    const displayName = ledgerDisplayName(row.customerName)
    let entry = byCustomer.get(customerKey)

    if (!entry) {
      byCustomer.set(customerKey, {
        customerKey,
        customerName: displayName,
        bookingIds: [row.bookingId],
        paymentDate: row.paymentDate,
        invoiceIds: [row.invoiceId],
        packageAmount: row.packageAmount,
        receivedAmount: row.receivedAmount,
        balance: row.balance,
        method: row.method,
        note: row.note,
        recordedByIds: [...row.recordedByIds],
      })
      continue
    }

    entry.bookingIds.push(row.bookingId)
    if (!entry.invoiceIds.includes(row.invoiceId)) entry.invoiceIds.push(row.invoiceId)
    entry.packageAmount += row.packageAmount
    entry.receivedAmount += row.receivedAmount
    entry.balance += row.balance
    for (const id of row.recordedByIds) {
      if (!entry.recordedByIds.includes(id)) entry.recordedByIds.push(id)
    }

    if (row.paymentDate.localeCompare(entry.paymentDate) >= 0) {
      entry.paymentDate = row.paymentDate
      entry.method = row.method
      if (row.note?.trim()) entry.note = row.note.trim()
    }
  }

  return [...byCustomer.values()].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
}

export default function ClientLedger({ payments, bookings, companyName, sarToPkrRate = 75, staffUsernames: staffMap = {} }: Props) {
  const router = useRouter()
  const [selectedCustomer, setSelectedCustomer] = useState<string>('__all__')
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<Set<string>>(new Set())
  const [selectedCurrency, setSelectedCurrency] = useState<'PKR' | 'SAR'>('PKR')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const formatVal = (valInPkr: number) => {
    if (selectedCurrency === 'SAR') {
      return sar(valInPkr / sarToPkrRate)
    }
    return pkr(valInPkr)
  }

  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>()
    for (const b of bookings) m.set(b.id, b)
    return m
  }, [bookings])

  // One row per customer — amounts sum across all invoices/bookings for that client
  const allRows = useMemo<LedgerRow[]>(
    () => aggregateCustomerLedgerRows(buildBookingLedgerRows(payments, bookingMap)),
    [payments, bookingMap],
  )

  const customerNames = useMemo(() => {
    const names = [...new Set(allRows.map(r => r.customerName))].sort()
    return names
  }, [allRows])

  const filteredRows = useMemo(() => {
    if (selectedCustomer === '__all__') return allRows
    return allRows.filter(r => r.customerName === selectedCustomer)
  }, [allRows, selectedCustomer])

  const totals = useMemo(() => {
    const rows = selectedCustomer === '__all__'
      ? allRows
      : allRows.filter(r => r.customerName === selectedCustomer)

    return {
      totalPackage: rows.reduce((sum, r) => sum + r.packageAmount, 0),
      totalReceived: rows.reduce((sum, r) => sum + r.receivedAmount, 0),
      totalBalance: rows.reduce((sum, r) => sum + r.balance, 0),
    }
  }, [allRows, selectedCustomer])

  const allSelected = filteredRows.length > 0 && filteredRows.every(r => selectedCustomerKeys.has(r.customerKey))

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedCustomerKeys(new Set(filteredRows.map(r => r.customerKey)))
    } else {
      setSelectedCustomerKeys(new Set())
    }
  }

  function toggleSelect(customerKey: string, checked: boolean) {
    setSelectedCustomerKeys(prev => {
      const next = new Set(prev)
      if (checked) next.add(customerKey)
      else next.delete(customerKey)
      return next
    })
  }

  function handleBulkDelete() {
    const bookingIds = [
      ...new Set(
        allRows
          .filter(r => selectedCustomerKeys.has(r.customerKey))
          .flatMap(r => r.bookingIds),
      ),
    ]
    startTransition(async () => {
      const result = await deleteLedgerEntries(bookingIds)
      if ('error' in result && result.error && !('success' in result)) {
        toast.error(result.error)
      } else if ('success' in result && result.success) {
        const count = 'deleted' in result ? result.deleted : bookingIds.length
        toast.success(`${count} ledger entr${count !== 1 ? 'ies' : 'y'} deleted`)
        if ('error' in result && result.error) toast.warning(result.error)
        setSelectedCustomerKeys(new Set())
        router.refresh()
      }
      setBulkDeleteOpen(false)
    })
  }

  function handlePrint() {
    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const filterLabel = selectedCustomer === '__all__' ? 'All Clients' : selectedCustomer

    const rowsHtml = filteredRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.paymentDate}</td>
        <td>${r.customerName}</td>
        <td>${formatLedgerInvoices(r.invoiceIds)}</td>
        <td style="text-align:right">${formatVal(r.packageAmount)}</td>
        <td style="text-align:right;color:#0b8050;font-weight:700">${formatVal(r.receivedAmount)}</td>
        <td style="text-align:right;color:#b73838">${formatVal(r.balance)}</td>
        <td>${r.method}</td>
        <td>${staffUsernames(staffMap, r.recordedByIds)}</td>
        <td>${r.note}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Client Ledger — ${companyName}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 16px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #071426; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 22px; color: #071426; }
    .header p { margin: 4px 0 0; color: #555; font-size: 12px; }
    .meta { text-align: right; font-size: 12px; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 7px 8px; text-align: left; vertical-align: middle; }
    th { background: #071426; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
    tr:nth-child(even) { background: #f9f9f9; }
    .summary { margin-top: 16px; display: flex; justify-content: flex-end; }
    .summary table { width: 340px; border-collapse: collapse; }
    .summary td { border: 1px solid #ddd; padding: 8px 10px; }
    .summary td:last-child { text-align: right; font-weight: 700; }
    .summary tr:last-child td { background: #071426; color: #fff; font-size: 13px; }
    .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${companyName}</h1>
      <p>Client Payment Ledger — ${filterLabel}</p>
    </div>
    <div class="meta">
      <p><strong>Print Date:</strong> ${today}</p>
      <p><strong>Total Entries:</strong> ${filteredRows.length}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th>Customer</th><th>Invoice</th>
        <th style="text-align:right">Package (${selectedCurrency})</th>
        <th style="text-align:right">Received (${selectedCurrency})</th>
        <th style="text-align:right">Balance (${selectedCurrency})</th>
        <th>Method</th><th>Recorded By</th><th>Note</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="10" style="text-align:center;color:#888;padding:20px">No entries found.</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <table>
      <tr><td>Total Package Amount</td><td>${formatVal(totals.totalPackage)}</td></tr>
      <tr><td>Total Received</td><td>${formatVal(totals.totalReceived)}</td></tr>
      <tr><td><strong>Remaining Balance</strong></td><td><strong>${formatVal(totals.totalBalance)}</strong></td></tr>
    </table>
  </div>
  <div class="footer">${companyName} · Printed on ${today}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); }<\/script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Popup blocked — please allow popups for this site'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  function handleCopy() {
    if (filteredRows.length === 0) { toast.error('No ledger entries to copy'); return }

    const filterLabel = selectedCustomer === '__all__' ? 'All Clients' : selectedCustomer
    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const divider = '─'.repeat(52)

    const lines: string[] = [
      `${companyName}`,
      `Client Payment Ledger — ${filterLabel}`,
      `Date: ${today}`,
      divider,
      '',
    ]

    for (const r of filteredRows) {
      lines.push(`Date       : ${r.paymentDate}`)
      lines.push(`Customer   : ${r.customerName}`)
      lines.push(`Invoice    : ${formatLedgerInvoices(r.invoiceIds)}`)
      lines.push(`Package    : ${formatVal(r.packageAmount)}`)
      lines.push(`Received   : ${formatVal(r.receivedAmount)}`)
      lines.push(`Balance    : ${formatVal(r.balance)}`)
      lines.push(`Method     : ${r.method}`)
      lines.push(`Recorded By: ${staffUsernames(staffMap, r.recordedByIds)}`)
      if (r.note) lines.push(`Note       : ${r.note}`)
      lines.push(divider)
    }

    lines.push('')
    lines.push(`Total Package   : ${formatVal(totals.totalPackage)}`)
    lines.push(`Total Received  : ${formatVal(totals.totalReceived)}`)
    lines.push(`Remaining Bal   : ${formatVal(totals.totalBalance)}`)

    const text = lines.join('\n')

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Ledger copied to clipboard!'))
        .catch(() => toast.error('Copy failed — please copy manually'))
    } else {
      toast.error('Clipboard not available on this connection')
    }
  }

  return (
    <>
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Client Ledger
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                One row per client — package, received, and balance totals combine all invoices for that customer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCustomerKeys.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedCustomerKeys.size})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Ledger
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Ledger
              </Button>
            </div>
          </div>
        </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filter by Client:</label>
            <Select value={selectedCustomer} onValueChange={v => v && setSelectedCustomer(v)}>
              <SelectTrigger className="w-[240px]">
                <SelectValue>
                  {selectedCustomer === '__all__' ? 'All Clients' : selectedCustomer}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[240px] !w-auto">
                <SelectItem value="__all__">All Clients</SelectItem>
                {customerNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCustomer !== '__all__' && (
              <button
                onClick={() => setSelectedCustomer('__all__')}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Currency:</label>
            <Select value={selectedCurrency} onValueChange={v => v && setSelectedCurrency(v as 'PKR' | 'SAR')}>
              <SelectTrigger className="w-[100px]">
                <SelectValue>{selectedCurrency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PKR">PKR</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={v => toggleSelectAll(Boolean(v))}
                    aria-label="Select all ledger entries"
                  />
                </TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs text-right">Package ({selectedCurrency})</TableHead>
                <TableHead className="text-xs text-right">Received ({selectedCurrency})</TableHead>
                <TableHead className="text-xs text-right">Balance ({selectedCurrency})</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Recorded By</TableHead>
                <TableHead className="text-xs">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-10 text-sm">
                    No payment entries found.
                  </TableCell>
                </TableRow>
              ) : filteredRows.map(r => (
                <TableRow key={r.customerKey} className="hover:bg-muted/20">
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomerKeys.has(r.customerKey)}
                      onCheckedChange={v => toggleSelect(r.customerKey, Boolean(v))}
                      aria-label={`Select ledger entry for ${r.customerName}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.paymentDate)}</TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">{r.customerName}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{formatLedgerInvoices(r.invoiceIds)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{formatVal(r.packageAmount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatVal(r.receivedAmount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-rose-600">{formatVal(r.balance)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.method}</Badge></TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{staffUsernames(staffMap, r.recordedByIds)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRows.length > 0 && (
          <div className="flex justify-end">
            <div className="rounded-xl bg-navy text-white p-4 w-full max-w-[360px] space-y-2.5">
              <div className="flex justify-between items-center gap-6 text-sm text-white/70">
                <span className="shrink-0">Total Package</span>
                <span className="font-semibold text-white tabular-nums whitespace-nowrap text-right">{formatVal(totals.totalPackage)}</span>
              </div>
              <div className="flex justify-between items-center gap-6 text-sm text-white/70">
                <span className="shrink-0">Total Received</span>
                <span className="font-semibold text-emerald-400 tabular-nums whitespace-nowrap text-right">{formatVal(totals.totalReceived)}</span>
              </div>
              <div className="border-t border-white/20 pt-2.5 flex justify-between items-center gap-6">
                <span className="text-sm font-bold shrink-0">Remaining Balance</span>
                <span className="text-sm font-bold text-rose-300 tabular-nums whitespace-nowrap text-right">{formatVal(totals.totalBalance)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected ledger entries?</DialogTitle>
            <DialogDescription>
              This removes all payment records for {selectedCustomerKeys.size} selected client
              {selectedCustomerKeys.size !== 1 ? 's' : ''} (all linked invoices) and resets their paid balance to zero.
              The bookings themselves will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
