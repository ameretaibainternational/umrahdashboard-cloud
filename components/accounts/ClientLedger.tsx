'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import type { Payment, Booking } from '@/lib/types'
import { pkr, formatDate, bookingInvoiceId } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Printer, Copy } from 'lucide-react'

interface Props {
  payments: Payment[]
  bookings: Booking[]
  companyName: string
}

interface LedgerRow {
  paymentDate: string
  customerName: string
  invoiceId: string
  packageAmount: number   // booking total (total_pkr)
  receivedAmount: number  // this payment's amount
  balance: number         // booking.total_pkr - booking.paid_pkr (current remaining)
  method: string
  note: string
}

export default function ClientLedger({ payments, bookings, companyName }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('__all__')

  // Build a map of bookingId → booking for O(1) lookups
  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>()
    for (const b of bookings) m.set(b.id, b)
    return m
  }, [bookings])

  // Build all ledger rows (sorted newest first)
  const allRows = useMemo<LedgerRow[]>(() => {
    return [...payments]
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
      .map(p => {
        const booking = bookingMap.get(p.booking_id)
        return {
          paymentDate: p.payment_date,
          customerName: p.customer_name,
          invoiceId: bookingInvoiceId(p.booking_id),
          packageAmount: booking?.total_pkr ?? 0,
          receivedAmount: p.amount_pkr,
          balance: booking?.remaining_pkr ?? 0,
          method: p.method,
          note: p.note || '',
        }
      })
  }, [payments, bookingMap])

  // Unique customer list for the filter dropdown
  const customerNames = useMemo(() => {
    const names = [...new Set(allRows.map(r => r.customerName))].sort()
    return names
  }, [allRows])

  // Filtered rows based on selected customer
  const filteredRows = useMemo(() => {
    if (selectedCustomer === '__all__') return allRows
    return allRows.filter(r => r.customerName === selectedCustomer)
  }, [allRows, selectedCustomer])

  // Totals — computed from the filtered set
  // totalPackage = sum of unique booking totals for the filtered customer
  const totals = useMemo(() => {
    // Collect unique booking IDs visible in this filter
    const seenBookings = new Set<string>()
    let totalReceived = 0

    for (const p of payments) {
      if (selectedCustomer !== '__all__' && p.customer_name !== selectedCustomer) continue
      totalReceived += p.amount_pkr
      seenBookings.add(p.booking_id)
    }

    // Sum the current balance of each unique booking
    let totalBalance = 0
    let totalPackage = 0
    for (const bookingId of seenBookings) {
      const b = bookingMap.get(bookingId)
      if (b) {
        totalPackage += b.total_pkr
        totalBalance += b.remaining_pkr
      }
    }

    return { totalPackage, totalReceived, totalBalance }
  }, [payments, bookingMap, selectedCustomer])

  // ── Print ──────────────────────────────────────────────────────────────────
  function handlePrint() {
    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const filterLabel = selectedCustomer === '__all__' ? 'All Clients' : selectedCustomer

    const rowsHtml = filteredRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.paymentDate}</td>
        <td>${r.customerName}</td>
        <td>${r.invoiceId}</td>
        <td style="text-align:right">${pkr(r.packageAmount)}</td>
        <td style="text-align:right;color:#0b8050;font-weight:700">${pkr(r.receivedAmount)}</td>
        <td style="text-align:right;color:#b73838">${pkr(r.balance)}</td>
        <td>${r.method}</td>
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
        <th style="text-align:right">Package</th>
        <th style="text-align:right">Received</th>
        <th style="text-align:right">Balance</th>
        <th>Method</th><th>Note</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="9" style="text-align:center;color:#888;padding:20px">No entries found.</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <table>
      <tr><td>Total Package Amount</td><td>${pkr(totals.totalPackage)}</td></tr>
      <tr><td>Total Received</td><td>${pkr(totals.totalReceived)}</td></tr>
      <tr><td><strong>Remaining Balance</strong></td><td><strong>${pkr(totals.totalBalance)}</strong></td></tr>
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

  // ── Copy to clipboard ──────────────────────────────────────────────────────
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
      lines.push(`Invoice    : ${r.invoiceId}`)
      lines.push(`Package    : ${pkr(r.packageAmount)}`)
      lines.push(`Received   : ${pkr(r.receivedAmount)}`)
      lines.push(`Balance    : ${pkr(r.balance)}`)
      lines.push(`Method     : ${r.method}`)
      if (r.note) lines.push(`Note       : ${r.note}`)
      lines.push(divider)
    }

    lines.push('')
    lines.push(`Total Package   : ${pkr(totals.totalPackage)}`)
    lines.push(`Total Received  : ${pkr(totals.totalReceived)}`)
    lines.push(`Remaining Bal   : ${pkr(totals.totalBalance)}`)

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
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Client Ledger
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payment ledger — filter by client, then print or copy for sharing.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
        {/* Customer filter */}
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

        {/* Ledger table */}
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs text-right">Package</TableHead>
                <TableHead className="text-xs text-right">Received</TableHead>
                <TableHead className="text-xs text-right">Balance</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                    No payment entries found.
                  </TableCell>
                </TableRow>
              ) : filteredRows.map((r, i) => (
                <TableRow key={i} className="hover:bg-muted/20">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.paymentDate)}</TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">{r.customerName}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.invoiceId}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{pkr(r.packageAmount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-600">{pkr(r.receivedAmount)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-rose-600">{pkr(r.balance)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.method}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals summary */}
        {filteredRows.length > 0 && (
          <div className="flex justify-end">
            <div className="rounded-xl bg-navy text-white p-4 min-w-[280px] space-y-2">
              <div className="flex justify-between text-sm text-white/70">
                <span>Total Package</span>
                <span className="font-semibold text-white">{pkr(totals.totalPackage)}</span>
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Total Received</span>
                <span className="font-semibold text-emerald-400">{pkr(totals.totalReceived)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between">
                <span className="text-sm font-bold">Remaining Balance</span>
                <span className="text-base font-bold text-rose-300">{pkr(totals.totalBalance)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
