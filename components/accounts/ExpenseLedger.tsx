'use client'

import { useMemo } from 'react'
import { toast } from 'sonner'
import type { Expense } from '@/lib/types'
import { pkr, formatDate } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Receipt, Printer, Copy } from 'lucide-react'

interface Props {
  expenses: Expense[]
  companyName: string
}

export default function ExpenseLedger({ expenses, companyName }: Props) {
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [expenses],
  )

  const totalAmount = useMemo(
    () => sortedExpenses.reduce((sum, e) => sum + e.amount_pkr, 0),
    [sortedExpenses],
  )

  function handlePrint() {
    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })

    const rowsHtml = sortedExpenses.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.expense_date}</td>
        <td>${e.expense_type}</td>
        <td>${e.supplier}</td>
        <td>${e.method}</td>
        <td style="text-align:right;color:#b73838;font-weight:700">${pkr(e.amount_pkr)}</td>
        <td>${e.note || ''}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Expense Ledger — ${companyName}</title>
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
      <p>Supplier / Expense Ledger</p>
    </div>
    <div class="meta">
      <p><strong>Print Date:</strong> ${today}</p>
      <p><strong>Total Entries:</strong> ${sortedExpenses.length}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th>Type</th><th>Supplier</th>
        <th>Method</th><th style="text-align:right">Amount</th><th>Note</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px">No entries found.</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <table>
      <tr><td>Total Expenses</td><td>${pkr(totalAmount)}</td></tr>
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
    if (sortedExpenses.length === 0) { toast.error('No expense entries to copy'); return }

    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const divider = '─'.repeat(52)

    const lines: string[] = [
      `${companyName}`,
      'Supplier / Expense Ledger',
      `Date: ${today}`,
      divider,
      '',
    ]

    for (const e of sortedExpenses) {
      lines.push(`Date       : ${e.expense_date}`)
      lines.push(`Type       : ${e.expense_type}`)
      lines.push(`Supplier   : ${e.supplier}`)
      lines.push(`Method     : ${e.method}`)
      lines.push(`Amount     : ${pkr(e.amount_pkr)}`)
      if (e.note) lines.push(`Note       : ${e.note}`)
      lines.push(divider)
    }

    lines.push('')
    lines.push(`Total Expenses  : ${pkr(totalAmount)}`)

    const text = lines.join('\n')

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('Expense ledger copied to clipboard!'))
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
              <Receipt className="w-4 h-4" />
              Supplier / Expense Ledger
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              All recorded supplier and Umrah expense payments — print or copy for sharing.
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
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Supplier / Description</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                    No expense records yet. Use the form above to add supplier payments.
                  </TableCell>
                </TableRow>
              ) : sortedExpenses.map(e => (
                <TableRow key={e.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.expense_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.expense_type}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{e.supplier}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.method}</Badge></TableCell>
                  <TableCell className="text-right text-sm font-semibold text-rose-600">{pkr(e.amount_pkr)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {sortedExpenses.length > 0 && (
          <div className="flex justify-end">
            <div className="rounded-xl bg-navy text-white p-4 min-w-[280px]">
              <div className="flex justify-between">
                <span className="text-sm font-bold">Total Expenses</span>
                <span className="text-base font-bold text-rose-300">{pkr(totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
