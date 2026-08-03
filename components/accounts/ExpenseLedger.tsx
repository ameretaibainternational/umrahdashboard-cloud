'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteExpenses } from '@/app/actions/accounts'
import type { Expense } from '@/lib/types'
import { pkr, formatDate } from '@/lib/formatters'
import { ledgerCustomerKey, ledgerDisplayName } from '@/lib/ledger-utils'
import { staffUsernames } from '@/lib/staff-lookup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Receipt, Printer, Copy, Trash2, Loader2 } from 'lucide-react'

interface Props {
  expenses: Expense[]
  companyName: string
  staffUsernames?: Record<string, string>
}

interface ExpenseLedgerRow {
  customerKey: string
  supplier: string
  expenseIds: string[]
  expense_date: string
  expense_type: string
  method: string
  amount_pkr: number
  note: string
  recordedByIds: string[]
}

function aggregateExpenseRows(expenses: Expense[]): ExpenseLedgerRow[] {
  const bySupplier = new Map<string, ExpenseLedgerRow & { types: Set<string> }>()

  for (const expense of expenses) {
    const customerKey = ledgerCustomerKey(expense.supplier)
    const supplier = ledgerDisplayName(expense.supplier)
    let entry = bySupplier.get(customerKey)

    if (!entry) {
      bySupplier.set(customerKey, {
        customerKey,
        supplier,
        expenseIds: [expense.id],
        expense_date: expense.expense_date,
        expense_type: expense.expense_type,
        method: expense.method,
        amount_pkr: expense.amount_pkr,
        note: expense.note || '',
        recordedByIds: expense.created_by ? [expense.created_by] : [],
        types: new Set([expense.expense_type]),
      })
      continue
    }

    entry.expenseIds.push(expense.id)
    entry.amount_pkr += expense.amount_pkr
    entry.types.add(expense.expense_type)
    if (expense.created_by && !entry.recordedByIds.includes(expense.created_by)) {
      entry.recordedByIds.push(expense.created_by)
    }

    if (expense.expense_date.localeCompare(entry.expense_date) >= 0) {
      entry.expense_date = expense.expense_date
      entry.method = expense.method
      entry.expense_type = expense.expense_type
      if (expense.note?.trim()) entry.note = expense.note.trim()
    }
  }

  return [...bySupplier.values()]
    .map(({ types, ...row }) => ({
      ...row,
      expense_type: types.size > 1 ? 'Multiple' : row.expense_type,
    }))
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
}

export default function ExpenseLedger({ expenses, companyName, staffUsernames: staffMap = {} }: Props) {
  const router = useRouter()
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const aggregatedRows = useMemo(
    () => aggregateExpenseRows(expenses),
    [expenses],
  )

  const totalAmount = useMemo(
    () => aggregatedRows.reduce((sum, row) => sum + row.amount_pkr, 0),
    [aggregatedRows],
  )

  const allSelected = aggregatedRows.length > 0 && aggregatedRows.every(r => selectedCustomerKeys.has(r.customerKey))

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedCustomerKeys(new Set(aggregatedRows.map(r => r.customerKey)))
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
    const ids = [
      ...new Set(
        aggregatedRows
          .filter(r => selectedCustomerKeys.has(r.customerKey))
          .flatMap(r => r.expenseIds),
      ),
    ]
    startTransition(async () => {
      const result = await deleteExpenses(ids)
      if ('error' in result && result.error && !('success' in result)) {
        toast.error(result.error)
      } else if ('success' in result && result.success) {
        const count = 'deleted' in result ? result.deleted : ids.length
        toast.success(`${count} expense${count !== 1 ? 's' : ''} deleted`)
        if ('error' in result && result.error) toast.warning(result.error)
        setSelectedCustomerKeys(new Set())
        router.refresh()
      }
      setBulkDeleteOpen(false)
    })
  }

  function handlePrint() {
    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })

    const rowsHtml = aggregatedRows.map((row, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${row.expense_date}</td>
        <td>${escapeHtml(row.expense_type)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td>${escapeHtml(row.method)}</td>
        <td style="text-align:right;color:#b73838;font-weight:700">${pkr(row.amount_pkr)}</td>
        <td>${escapeHtml(staffUsernames(staffMap, row.recordedByIds))}</td>
        <td>${escapeHtml(row.note || '')}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Expense Ledger — ${escapeHtml(companyName)}</title>
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
      <h1>${escapeHtml(companyName)}</h1>
      <p>Supplier / Expense Ledger</p>
    </div>
    <div class="meta">
      <p><strong>Print Date:</strong> ${today}</p>
      <p><strong>Total Entries:</strong> ${aggregatedRows.length}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th>Type</th><th>Supplier</th>
        <th>Method</th><th style="text-align:right">Amount</th><th>Recorded By</th><th>Note</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px">No entries found.</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <table>
      <tr><td>Total Expenses</td><td>${pkr(totalAmount)}</td></tr>
    </table>
  </div>
  <div class="footer">${escapeHtml(companyName)} · Printed on ${today}</div>
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
    if (aggregatedRows.length === 0) { toast.error('No expense entries to copy'); return }

    const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const divider = '─'.repeat(52)

    const lines: string[] = [
      `${companyName}`,
      'Supplier / Expense Ledger',
      `Date: ${today}`,
      divider,
      '',
    ]

    for (const row of aggregatedRows) {
      lines.push(`Date       : ${row.expense_date}`)
      lines.push(`Type       : ${row.expense_type}`)
      lines.push(`Supplier   : ${row.supplier}`)
      lines.push(`Method     : ${row.method}`)
      lines.push(`Amount     : ${pkr(row.amount_pkr)}`)
      lines.push(`Recorded By: ${staffUsernames(staffMap, row.recordedByIds)}`)
      if (row.note) lines.push(`Note       : ${row.note}`)
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
    <>
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Supplier / Expense Ledger
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                One row per supplier — amounts combine all package and invoice expenses for that customer.
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
          <div className="rounded-lg border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={v => toggleSelectAll(Boolean(v))}
                      aria-label="Select all expenses"
                    />
                  </TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Supplier / Description</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Recorded By</TableHead>
                  <TableHead className="text-xs">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                      No expense records yet. Package supplier costs appear here when customer payments are logged.
                    </TableCell>
                  </TableRow>
                ) : aggregatedRows.map(row => (
                  <TableRow key={row.customerKey} className="hover:bg-muted/20">
                    <TableCell>
                      <Checkbox
                        checked={selectedCustomerKeys.has(row.customerKey)}
                        onCheckedChange={v => toggleSelect(row.customerKey, Boolean(v))}
                        aria-label={`Select expense for ${row.supplier}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.expense_date)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{row.expense_type}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{row.supplier}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{row.method}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-semibold text-rose-600">{pkr(row.amount_pkr)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{staffUsernames(staffMap, row.recordedByIds)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {aggregatedRows.length > 0 && (
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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected expenses?</DialogTitle>
            <DialogDescription>
              This will permanently delete all expense records for {selectedCustomerKeys.size} selected supplier
              {selectedCustomerKeys.size !== 1 ? 's' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {selectedCustomerKeys.size} supplier{selectedCustomerKeys.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
