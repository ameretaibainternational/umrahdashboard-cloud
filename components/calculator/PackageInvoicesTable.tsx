'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Pencil, Trash2, Loader2, Calculator } from 'lucide-react'
import { deleteCustomInvoice } from '@/app/actions/custom-invoices'
import { downloadStoredPdf } from '@/lib/storage-client'
import { pkr, formatDate } from '@/lib/formatters'
import { getPackageDataFromInvoice, isPackageInvoice } from '@/lib/package-invoice'
import type { CustomInvoice } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Props {
  invoices: CustomInvoice[]
  canManage?: boolean
}

export default function PackageInvoicesTable({ invoices, canManage = true }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDownload(inv: CustomInvoice) {
    if (inv.file_deleted_at) {
      toast.error('PDF file was removed from storage.')
      return
    }
    if (!inv.storage_key) {
      toast.error('No stored PDF for this invoice.')
      return
    }
    setDownloadingId(inv.id)
    try {
      await downloadStoredPdf(inv.id, 'invoice')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloadingId(null)
    }
  }

  function handleDelete(inv: CustomInvoice) {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    setDeletingId(inv.id)
    startTransition(async () => {
      const result = await deleteCustomInvoice(inv.id)
      setDeletingId(null)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Invoice deleted.')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="px-4 sm:px-6 py-4 border-b bg-muted/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {invoices.length} package invoice{invoices.length !== 1 ? 's' : ''}
        </p>
        {canManage && (
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="sm:hidden">Calculator</span>
            <span className="hidden sm:inline">New from Calculator</span>
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">Invoice #</TableHead>
            <TableHead className="text-xs">Customer</TableHead>
            <TableHead className="text-xs">Travel Date</TableHead>
            <TableHead className="text-xs text-right">Amount</TableHead>
            <TableHead className="text-xs text-right">Balance</TableHead>
            <TableHead className="text-xs">Saved</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            {canManage && <TableHead className="text-xs text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-12 text-sm">
                No saved package invoices yet. Use the Package Calculator and click Download to save one.
              </TableCell>
            </TableRow>
          ) : invoices.map(inv => {
            const pkg = getPackageDataFromInvoice(inv)
            const pax = pkg ? pkg.adult + pkg.child + pkg.infant : null
            return (
              <TableRow key={inv.id} className="hover:bg-muted/20">
                <TableCell className="text-xs font-mono font-semibold text-navy">{inv.invoice_number}</TableCell>
                <TableCell className="font-medium text-sm">
                  {inv.billed_to_name}
                  {pax != null && pax > 0 && (
                    <span className="text-[10px] block text-muted-foreground">{pax} pax</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {pkg?.travelDate ? formatDate(pkg.travelDate) : '—'}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">{pkr(inv.total)}</TableCell>
                <TableCell className="text-right text-sm text-amber-600">{pkr(inv.remaining)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(inv.created_at.slice(0, 10))}</TableCell>
                <TableCell>
                  <Badge variant="outline"
                    className={inv.remaining > 0
                      ? 'text-amber-600 border-amber-200 bg-amber-50 text-[10px]'
                      : 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]'
                    }
                  >
                    {inv.remaining > 0 ? 'Due' : 'Paid'}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={!inv.storage_key || !!inv.file_deleted_at || downloadingId === inv.id}
                        onClick={() => handleDownload(inv)}
                        title="Download PDF"
                      >
                        {downloadingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                      <Link
                        href={`/calculator?edit=${inv.id}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"
                        title="Edit in calculator"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={isPending && deletingId === inv.id}
                        onClick={() => handleDelete(inv)}
                        title="Delete"
                      >
                        {isPending && deletingId === inv.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
